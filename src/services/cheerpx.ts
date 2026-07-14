// CheerpX is loaded dynamically to avoid crashing the app at startup.
// @leaningtech/cheerpx checks for crossOriginIsolated at import time and
// throws if it is false — which would break the entire JS bundle before
// React even mounts. Dynamic import defers that check to when the terminal
// is actually opened.

let bootPromise: Promise<any> | null = null;
let cxInstance: any | null = null;

const IMAGE_URL = "https://disks.webvm.io/debian_large_20230522_5044875331.ext2";

export async function getCheerpX(): Promise<any> {
  if (!bootPromise) {
    bootPromise = (async () => {
      // Dynamic import — only runs when this function is called, not at module load
      const CheerpX = await import('@leaningtech/cheerpx');

      const cloudDevice = await CheerpX.CloudDevice.create(IMAGE_URL);
      const idbDevice   = await CheerpX.IDBDevice.create("cheerpx_storage");
      const overlayDevice = await CheerpX.OverlayDevice.create(cloudDevice, idbDevice);

      cxInstance = await CheerpX.Linux.create({
        mounts: [{ type: "ext2", path: "/", dev: overlayDevice }],
      });

      return cxInstance;
    })();
  }
  return bootPromise;
}

import { fetchRepoTree } from './webcontainer';
import type { FileSystemTree } from '@webcontainer/api';

export async function syncRepoToCheerpX(
  owner: string,
  repo: string,
  branch: string,
  cx: any
) {
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
        try {
          const content =
            typeof node.file.contents === 'string'
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

  const scriptB64 = btoa(unescape(encodeURIComponent(script)));
  await cx.run('/bin/bash', [
    '-c',
    `echo "${scriptB64}" | base64 -d > /tmp/sync.sh && bash /tmp/sync.sh`,
  ]);

  return `/home/user/workspace/${repo}`;
}

export async function writeFileToCheerpX(
  owner: string,
  repo: string,
  filePath: string,
  content: string
) {
  if (!cxInstance) return;
  const b64 = btoa(unescape(encodeURIComponent(content)));
  const fullPath = `/home/user/workspace/${repo}/${filePath}`;
  await cxInstance.run('/bin/bash', [
    '-c',
    `mkdir -p "$(dirname "${fullPath}")" && echo "${b64}" | base64 -d > "${fullPath}"`
  ]);
}
