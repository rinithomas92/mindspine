import { currentUser } from "@/lib/auth";
import { getAppData } from "@/lib/data";
import Workspace from "@/components/workspace";
import SplashGate from "@/components/splash-gate";
export const dynamic = "force-dynamic";
export default async function Page() {
    const user = await currentUser();
    return user ? (<Workspace data={await getAppData(user)}/>) : (<SplashGate/>);
}
