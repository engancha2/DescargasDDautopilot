import { execSync } from "child_process";
import { logActivity } from "./db";

export interface JDStatus {
  connected: boolean;
  downloads: JDDownload[];
}

export interface JDDownload {
  name: string;
  progress: number;
  speed: number;
  status: string;
  eta: number;
}

function runPython(script: string, timeout = 30): string {
  try {
    const escaped = script.replace(/'/g, "'\\''");
    const result = execSync(`python3 -c '${escaped}'`, {
      timeout: timeout * 1000,
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    });
    return result.trim();
  } catch (e: any) {
    const msg = (e.stderr || e.message || "").substring(0, 500);
    throw new Error(msg);
  }
}

export async function testJDConnection(email: string, password: string): Promise<{ success: boolean; error?: string; deviceName?: string }> {
  try {
    const script = `
import myjdapi, json, sys
jd = myjdapi.Myjdapi()
jd.set_app_key("descargasdd_manager")
jd.connect("${email}", "${password}")
devices = jd.list_devices()
if devices:
    d = devices[0]
    name = d["name"] if isinstance(d, dict) else d.name
    print("OK:" + name)
else:
    print("ERROR:no_devices")
`;
    const result = runPython(script, 30);
    if (result.startsWith("OK:")) {
      return { success: true, deviceName: result.substring(3) };
    }
    return { success: false, error: result.replace("ERROR:", "") };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function addLinksToJD(
  email: string,
  password: string,
  links: string,
  downloadFolder: string,
  packageName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    logActivity("info", "JD addLinksToJD", `links length: ${links.length}, first 200: ${links.substring(0, 200)}`);
    
    // Write links to a temp file to avoid escaping issues
    const tmpFile = `/tmp/jd_links_${Date.now()}.txt`;
    const fs = require("fs");
    fs.writeFileSync(tmpFile, links);
    const metaFile = tmpFile + ".meta";
    fs.writeFileSync(metaFile, JSON.stringify({ packageName, destinationFolder: downloadFolder }));
    
    const script = `
import myjdapi, json, sys
jd = myjdapi.Myjdapi()
jd.set_app_key("descargasdd_manager")
jd.connect("${email}", "${password}")
devices = jd.list_devices()
if not devices:
    print("ERROR:no_devices")
    sys.exit(1)
d = devices[0]
dev = jd.get_device(d["name"] if isinstance(d, dict) else d.name)
import json
with open("${tmpFile}") as f:
    all_text = f.read()
# Write metadata to a second temp file to avoid escaping issues
meta_file = "${tmpFile}.meta"
with open(meta_file, "w") as f:
    json.dump({"packageName": ${JSON.stringify(packageName)}, "destinationFolder": ${JSON.stringify(downloadFolder)}}, f)
with open(meta_file) as f:
    meta = json.load(f)
params = [{
    "autostart": True,
    "links": all_text,
    "packageName": meta["packageName"],
    "destinationFolder": meta["destinationFolder"],
    "priority": "DEFAULT",
    "overwritePackagizerRules": False
}]
dev.linkgrabber.add_links(params)
print("OK")
`;
    const result = runPython(script, 30);
    return { success: result === "OK" };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getJDStatus(email: string, password: string): Promise<JDStatus> {
  try {
    const script = `
import myjdapi, json
jd = myjdapi.Myjdapi()
jd.set_app_key("descargasdd_manager")
jd.connect("${email}", "${password}")
devices = jd.list_devices()
if not devices:
    print(json.dumps({"connected": False, "downloads": []}))
    exit(0)
d = devices[0]
dev = jd.get_device(d["name"] if isinstance(d, dict) else d.name)
try:
    downloads = dev.linkgrabber.query_packages()
except:
    downloads = []
result = []
print(json.dumps({"connected": True, "downloads": result}))
`;
    const result = runPython(script);
    return JSON.parse(result);
  } catch (e) {
    return { connected: false, downloads: [] };
  }
}
