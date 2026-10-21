import { currentUser } from "@/lib/auth";
import { run, audit } from "@/lib/db";
export const runtime = "nodejs";

const MAX_SIZE = 2 * 1024 * 1024;

function checkOrigin(request: Request) {
    const origin = request.headers.get("origin");
    try {
        const source = new URL(origin || "");
        return ["http:", "https:"].includes(source.protocol) &&
            source.host === request.headers.get("host");
    }
    catch {
        return false;
    }
}

function sniffImage(content: Buffer): string | null {
    if (content.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
        const tail = content.subarray(-12);
        const validEnd = tail.subarray(4, 8).toString("ascii") === "IEND" &&
            tail.subarray(8, 12).equals(Buffer.from([0xae, 0x42, 0x60, 0x82]));
        return validEnd ? "image/png" : null;
    }
    if (content[0] === 255 && content[1] === 216 && content[2] === 255) {
        return content[content.length - 2] === 255 && content[content.length - 1] === 217
            ? "image/jpeg"
            : null;
    }
    if (content.subarray(0, 4).toString("ascii") === "RIFF" && content.subarray(8, 12).toString("ascii") === "WEBP") {
        const declaredSize = content.readUInt32LE(4);
        return declaredSize + 8 === content.length ? "image/webp" : null;
    }
    return null;
}

export async function POST(request: Request) {
    const user = await currentUser();
    if (!user)
        return Response.json({ error: "Sign in required." }, { status: 401 });
    if (!checkOrigin(request))
        return Response.json({ error: "Invalid origin." }, { status: 403 });
    if (Number(request.headers.get("content-length")) > MAX_SIZE + 1024)
        return Response.json({ error: "Choose an image up to 2 MB." }, { status: 413 });
    try {
        const form = await request.formData();
        const kind = form.get("kind") === "logo" ? "logo" : "avatar";
        if (kind === "logo" && !(user.role === "practitioner" && ["physiotherapist", "psychologist"].includes(user.specialty || "")))
            return Response.json({ error: "Practice logos are available only to practitioners." }, { status: 403 });
        const file = form.get("file");
        if (!(file instanceof File) || file.size === 0 || file.size > MAX_SIZE)
            return Response.json({ error: "Choose an image up to 2 MB." }, { status: 400 });
        const content = Buffer.from(await file.arrayBuffer());
        const mime = sniffImage(content);
        if (!mime || mime !== file.type)
            return Response.json({ error: "Only PNG, JPEG, and WEBP images are supported." }, { status: 400 });
        // Practice logos are embedded into generated PDFs, which only support PNG/JPEG (no WEBP) —
        // reject here rather than silently falling back to the default MindSpine mark at render time.
        if (kind === "logo" && mime === "image/webp")
            return Response.json({ error: "Logos must be PNG or JPEG (WEBP can't be used in PDF reports)." }, { status: 400 });
        const avatar = `data:${mime};base64,${content.toString("base64")}`;
        await run(`UPDATE users SET ${kind === "logo" ? "practitioner_logo" : "avatar"}=? WHERE id=?`, avatar, user.id);
        await audit(user.id, kind === "logo" ? "profile.logo_updated" : "profile.avatar_updated", user.id);
        return Response.json({ [kind === "logo" ? "logo" : "avatar"]: avatar });
    }
    catch {
        return Response.json({ error: "Unable to upload this image." }, { status: 400 });
    }
}

export async function DELETE(request: Request) {
    const user = await currentUser();
    if (!user)
        return Response.json({ error: "Sign in required." }, { status: 401 });
    if (!checkOrigin(request))
        return Response.json({ error: "Invalid origin." }, { status: 403 });
    const kind = new URL(request.url).searchParams.get("kind") === "logo" ? "logo" : "avatar";
    if (kind === "logo" && !(user.role === "practitioner" && ["physiotherapist", "psychologist"].includes((user as { specialty?: string }).specialty || "")))
        return Response.json({ error: "Practice logos are available only to practitioners." }, { status: 403 });
    await run(`UPDATE users SET ${kind === "logo" ? "practitioner_logo" : "avatar"}='' WHERE id=?`, user.id);
    await audit(user.id, kind === "logo" ? "profile.logo_removed" : "profile.avatar_removed", user.id);
    return Response.json({ message: kind === "logo" ? "Practice logo removed." : "Profile picture removed." });
}
