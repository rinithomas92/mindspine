import { currentUser } from "@/lib/auth";
import { getAppData } from "@/lib/data";
import Workspace from "@/components/workspace";
import Login from "@/components/login";
export const dynamic = "force-dynamic";
export default async function Page() {
    const user = await currentUser();
    return user ? (<Workspace data={await getAppData(user)}/>) : (<Login/>);
}
