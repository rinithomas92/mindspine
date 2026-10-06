import { currentUser } from "@/lib/auth";
import { canAccessPatient } from "@/lib/domain";
import { one, run, id, audit } from "@/lib/db";
export const runtime = "nodejs";
export async function GET(request: Request) {
    const user = await currentUser();
    if (!user)
        return Response.json({ error: "Sign in required." }, { status: 401 });
    const file = await one<{
        id: string;
        patient_id: string;
        name: string;
        mime: string;
        content: Uint8Array;
    }>("SELECT * FROM files WHERE id=?", new URL(request.url).searchParams.get("id") || "");
    if (!file || !await canAccessPatient(user, file.patient_id))
        return Response.json({ error: "File not found." }, { status: 404 });
    await audit(user.id, "file.downloaded", file.id);
    return new Response(new Uint8Array(file.content), {
        headers: {
            "Content-Type": file.mime,
            "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    });
}
export async function POST(request: Request) {
    const user = await currentUser();
    if (!user || user.role !== "practitioner")
        return Response.json({ error: "Clinician access required." }, { status: 403 });
    const origin = request.headers.get("origin");
    let sameOrigin = false;
    try {
        const source = new URL(origin || "");
        sameOrigin =
            ["http:", "https:"].includes(source.protocol) &&
                source.host === request.headers.get("host");
    }
    catch {
        /* A missing or malformed Origin is not authorized. */
    }
    if (!sameOrigin)
        return Response.json({ error: "Invalid origin." }, { status: 403 });
    if (Number(request.headers.get("content-length")) > 6 * 1024 * 1024)
        return Response.json({ error: "Maximum file size is 5 MB." }, { status: 413 });
    try {
        const form = await request.formData(), file = form.get("file"), patientId = String(form.get("patientId") || "");
        if (!await canAccessPatient(user, patientId))
            return Response.json({ error: "Patient access denied." }, { status: 403 });
        if (!(file instanceof File) ||
            file.size === 0 ||
            file.size > 5 * 1024 * 1024)
            return Response.json({ error: "Choose a file up to 5 MB." }, { status: 400 });
        const content = Buffer.from(await file.arrayBuffer());
        const mime = content.subarray(0, 5).toString() === "%PDF-"
            ? "application/pdf"
            : content
                .subarray(0, 8)
                .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
                ? "image/png"
                : content[0] === 255 && content[1] === 216 && content[2] === 255
                    ? "image/jpeg"
                    : null;
        if (!mime || mime !== file.type)
            return Response.json({ error: "Only valid PDF, PNG, and JPEG files are supported." }, { status: 400 });
        const fileId = id("FILE");
        await run("INSERT INTO files(id,patient_id,uploaded_by,name,mime,size,content) VALUES (?,?,?,?,?,?,?)", fileId, patientId, user.id, file.name.replace(/[\r\n\\/]/g, "_").slice(0, 180), mime, file.size, content);
        await audit(user.id, "file.uploaded", fileId);
        return Response.json({ message: "Document uploaded successfully." });
    }
    catch {
        return Response.json({ error: "Unable to upload this document." }, { status: 400 });
    }
}

