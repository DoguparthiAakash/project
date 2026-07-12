import * as CheerpX from '@leaningtech/cheerpx';

let bootPromise: Promise<CheerpX.Linux> | null = null;
let cxInstance: CheerpX.Linux | null = null;

// Use the webvm image as a base
const IMAGE_URL = "https://disks.webvm.io/debian_large_20230522_5044875331.ext2";

export async function getCheerpX(): Promise<CheerpX.Linux> {
  if (!bootPromise) {
    bootPromise = (async () => {
      // 1. Create a cloud device for the base OS image
      const cloudDevice = await CheerpX.CloudDevice.create(IMAGE_URL);
      
      // 2. Create an IndexedDB device for persistent, writable storage
      const idbDevice = await CheerpX.IDBDevice.create("cheerpx_storage");
      
      // 3. Create an overlay device that combines the read-only base with the writable storage
      const overlayDevice = await CheerpX.OverlayDevice.create(cloudDevice, idbDevice);
      
      // 4. Initialize the Linux environment with the overlay device
      cxInstance = await CheerpX.Linux.create({
        mounts: [
          { type: "ext2", path: "/", dev: overlayDevice }
        ]
      });
      
      return cxInstance;
    })();
  }
  return bootPromise;
}

import { fetchRepoTree } from './webcontainer';
import type { FileSystemTree } from '@webcontainer/api';

export async function syncRepoToCheerpX(owner: string, repo: string, branch: string, cx: any) {
  // We can't use git clone inside CheerpX because Tailscale network is not configured.
  // Instead, we will fetch the repo tree using GitHub API and write it to the WebVM.
  
  await cx.run('/bin/bash', ['-c', `mkdir -p /home/user/workspace/${repo}`]);
  
  const tree = await fetchRepoTree(owner, repo, branch);
  
  let script = `#!/bin/bash\n`;
  script += `cd /home/user/workspace/${repo}\n`;
  
  function buildScript(nodeTree: FileSystemTree, currentPath: string) {
    for (const [name, node] of Object.entries(nodeTree)) {
      const fullPath = currentPath ? `${currentPath}/${name}` : name;
      if ('directory' in node) {
        script += `mkdir -p "${fullPath}"\n`;
        buildScript(node.directory, fullPath);
      } else if ('file' in node && 'contents' in node.file) {
        // Base64 encode the content safely
        try {
          const content = typeof node.file.contents === 'string' 
            ? node.file.contents 
            : new TextDecoder().decode(node.file.contents);
            
          const b64 = btoa(unescape(encodeURIComponent(content)));
          script += `echo "${b64}" | base64 -d > "${fullPath}"\n`;
        } catch (e) {
          console.warn(`Could not encode file ${fullPath}`, e);
        }
      }
    }
  }
  
  buildScript(tree, "");
  
  // Write the script to a temporary file via a small base64 command, then execute it
  const scriptB64 = btoa(unescape(encodeURIComponent(script)));
  await cx.run('/bin/bash', ['-c', `echo "${scriptB64}" | base64 -d > /tmp/sync.sh && bash /tmp/sync.sh`]);
  
  return `/home/user/workspace/${repo}`;
}
