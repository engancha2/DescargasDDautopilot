import { execSync } from "child_process";
import { logActivity } from "./db";

export interface ForumPost {
  title: string;
  url: string;
  postId: string;
  isSeries: boolean;
  isMovie: boolean;
}

export interface DownloadLink {
  url: string;
  provider: string;
}

// Tab index for our scraper tab (separate from user's tabs)
let scraperTabIndex = 0;

function runJsInChrome(jsCode: string, timeout = 15): string {
  const escaped = jsCode.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ");
  let tabRef = "active tab of first window";
  if (scraperTabIndex >= 1) {
    tabRef = `tab ${scraperTabIndex} of first window`;
  }
  const script = `tell application "Google Chrome"\nset t to ${tabRef}\nset result to execute t javascript "${escaped}"\nreturn result\nend tell`;
  try {
    const result = execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
      timeout: timeout * 1000,
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    });
    return result.trim();
  } catch (e) {
    return "";
  }
}

// Find the tab that has descargasdd.org open, or create one
function ensureScraperTab(targetUrl?: string) {
  if (scraperTabIndex >= 1) {
    const check = runAppleScript(
      `tell application "Google Chrome" to count tabs of first window`
    );
    const count = parseInt(check.trim());
    if (scraperTabIndex <= count) {
      const url = runJsInChrome("document.URL;");
      if (url.includes("descargasdd.org")) {
        return; // Tab still good
      }
    }
  }
  
  // Look for an existing tab with descargasdd.org
  const tabCountStr = runAppleScript(`tell application "Google Chrome" to count tabs of first window`);
  const tabCount = parseInt(tabCountStr.trim());
  
  for (let i = 1; i <= tabCount; i++) {
    const tabUrl = runAppleScript(`tell application "Google Chrome" to get URL of tab ${i} of first window`);
    if (tabUrl.includes("descargasdd.org")) {
      scraperTabIndex = i;
      return;
    }
  }
  
  // No existing tab found - create one going DIRECTLY to the target URL
  const createUrl = targetUrl || "https://descargasdd.org";
  runAppleScript(`
tell application "Google Chrome"
  tell first window
    set newTab to make new tab with properties {URL:"${createUrl}"}
  end tell
end tell`);
  
  sleep(8000);
  
  const countStr = runAppleScript(`tell application "Google Chrome" to count tabs of first window`);
  scraperTabIndex = parseInt(countStr.trim());
  
  logActivity("info", `Nueva pestaña creada (índice ${scraperTabIndex})`);
}

function runAppleScript(script: string, timeout = 15): string {
  try {
    const result = execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
      timeout: timeout * 1000,
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    });
    return result.trim();
  } catch (e) {
    return "";
  }
}

export function navigateTo(url: string) {
  // Always find the descargasdd tab first
  const tabCountStr = runAppleScript(`tell application "Google Chrome" to count tabs of first window`);
  const tabCount = parseInt(tabCountStr.trim());
  
  // Check if our current scraper tab is still valid
  let found = false;
  if (scraperTabIndex >= 1 && scraperTabIndex <= tabCount) {
    const tabUrl = runAppleScript(`tell application "Google Chrome" to get URL of tab ${scraperTabIndex} of first window`);
    if (tabUrl.includes("descargasdd.org")) {
      found = true;
    }
  }
  
  // If not found, search for any descargasdd tab
  if (!found) {
    for (let i = 1; i <= tabCount; i++) {
      const tabUrl = runAppleScript(`tell application "Google Chrome" to get URL of tab ${i} of first window`);
      if (tabUrl.includes("descargasdd.org")) {
        scraperTabIndex = i;
        found = true;
        break;
      }
    }
  }
  
  // If still not found, create a new tab going directly to the URL
  if (!found) {
    runAppleScript(`
tell application "Google Chrome"
  tell first window
    set newTab to make new tab with properties {URL:"${url}"}
  end tell
end tell`);
    sleep(8000);
    const countStr = runAppleScript(`tell application "Google Chrome" to count tabs of first window`);
    scraperTabIndex = parseInt(countStr.trim());
    return; // Tab was created with the URL already
  }
  
  // Navigate the scraper tab to the URL
  runJsInChrome(`window.location.href = "${url}";`);
  sleep(5000);
}

export function getCurrentUrl(): string {
  return runJsInChrome("document.URL;");
}

export function getPageTitle(): string {
  return runJsInChrome("document.title;");
}

export function scanForumPage(forumUrl: string): ForumPost[] {
  navigateTo(forumUrl);
  
  // Wait for page to be ready
  let attempts = 0;
  while (attempts < 10) {
    const ready = runJsInChrome('document.readyState;');
    if (ready === "complete") break;
    sleep(1000);
    attempts++;
  }
  
  // Debug: log what we see
  const pageTitle = runJsInChrome('document.title;');
  logActivity("info", `Página cargada: "${pageTitle}" en tab ${scraperTabIndex}`);
  
  const js = `(function(){
    var links = document.querySelectorAll("a[href*=showthread]");
    var seen = {};
    var results = [];
    for (var i = 0; i < links.length; i++) {
      var title = links[i].textContent.trim();
      var url = links[i].href;
      if (!title || title.length < 5) continue;
      if (title.indexOf("Donaciones") !== -1) continue;
      if (title.indexOf("Listado") !== -1) continue;
      if (title.indexOf("Sigue que") !== -1) continue;
      if (title.indexOf("Canal Telegram") !== -1) continue;
      if (title.indexOf("canal Telegram") !== -1) continue;
      var match = url.match(/t=(\\d+)/);
      if (!match) continue;
      var threadId = match[1];
      if (seen[threadId]) continue;
      seen[threadId] = true;
      var isSeries = /T\\d+|Temporada|Season/i.test(title);
      var isMovie = !isSeries;
      results.push({title: title, url: "https://descargasdd.org/showthread.php?t=" + threadId, postId: threadId, isSeries: isSeries, isMovie: isMovie});
    }
    return JSON.stringify(results);
  })()`;
  
  const result = runJsInChrome(js);
  try {
    return JSON.parse(result);
  } catch {
    return [];
  }
}

export function scanForumAllPages(forumUrl: string, maxPages = 5): ForumPost[] {
  const allPosts: ForumPost[] = [];
  
  for (let page = 1; page <= maxPages; page++) {
    const url = forumUrl.includes("page=") 
      ? forumUrl.replace(/page=\d+/, `page=${page}`)
      : `${forumUrl}${forumUrl.includes("?") ? "&" : "?"}page=${page}`;
    
    logActivity("scan", `Escaneando página ${page}: ${url}`);
    const posts = scanForumPage(url);
    
    if (posts.length === 0) break;
    allPosts.push(...posts);
    
    const hasNext = runJsInChrome(`document.querySelector("a[rel=next]") ? "yes" : "no";`);
    if (hasNext !== "yes") break;
    
    sleep(2000);
  }
  
  return allPosts;
}

export function giveThanks(postId: string): boolean {
  // First check if thanks were already given
  const alreadyGiven = runJsInChrome(`document.getElementById("post_thanks_bit_${postId}") ? (document.getElementById("post_thanks_bit_${postId}").textContent.indexOf("Engancha2") !== -1 ? "already" : "no") : "no";`);
  
  if (alreadyGiven === "already") {
    return true; // Already gave thanks, that's fine
  }
  
  // Try to click the thanks button
  const js = `(function(){
    var btn = document.getElementById("post_thanks_button_${postId}");
    if (btn) { btn.click(); return "clicked"; }
    return "not found";
  })()`;
  
  const result = runJsInChrome(js);
  sleep(3000);
  
  // Verify
  const verify = runJsInChrome(`document.getElementById("post_thanks_bit_${postId}") ? (document.getElementById("post_thanks_bit_${postId}").textContent.indexOf("Engancha2") !== -1 ? "true" : "false") : "not found";`);
  
  return verify === "true" || verify === "already";
}

export function extractDownloadLinks(postId: string): DownloadLink[] {
  const debugUrl = runJsInChrome("document.URL;");
  logActivity("info", "Extractor tab " + scraperTabIndex + " URL: " + debugUrl);
  
  // Simple approach: get ALL text from ALL code blocks in the page
  const js = [
    '(function(){',
    'var text="";',
    'var codes=document.querySelectorAll(".bbcode_code");',
    'for(var i=0;i<codes.length;i++){text+=codes[i].textContent+"\n";}',
    'var links=document.querySelectorAll("a[href]");',
    'for(var j=0;j<links.length;j++){var h=links[j].href;if(h.indexOf("http")===0&&h.indexOf("descargasdd")===-1&&h.indexOf("member")===-1&&h.indexOf("search")===-1&&h.indexOf("private")===-1&&h.indexOf("profile")===-1&&h.indexOf("newreply")===-1&&h.indexOf("post_thanks")===-1&&h.indexOf("report")===-1&&h.indexOf("showthread")===-1&&h.indexOf("telegram")===-1&&h.indexOf("t.me")===-1&&h.indexOf("youtube")===-1&&h.indexOf("youtu.be")===-1){text+="\n"+h;}}',
    'text=text.replace(/https?:\\/\\/(?:www\\.)?youtube\\.com\\/[^"\\n]*/g,"").replace(/https?:\\/\\/(?:www\\.)?youtu\\.be\\/[^"\\n]*/g,"");',
    'if(!text)return "[]";',
    'return JSON.stringify([{url:text,provider:"all"}]);',
    '})()'
  ].join("");
  
  const result = runJsInChrome(js);
  logActivity("info", "Extractor raw result: " + result.substring(0, 200));
  
  try {
    return JSON.parse(result);
  } catch {
    return [];
  }
}

export function replyToPost(postId: string, message: string): boolean {
  navigateTo(`https://descargasdd.org/newreply.php?do=newreply&p=${postId}&noquote=1`);
  
  const escapedMsg = message.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  runJsInChrome(`var e = document.getElementById("vB_Editor_001_editor"); e.focus(); e.value = "${escapedMsg}";`);
  runJsInChrome(`var f = document.querySelector("iframe"); if (f) { f.contentDocument.body.innerHTML = "${escapedMsg}"; }`);
  
  sleep(1000);
  runJsInChrome(`document.getElementById("vB_Editor_001_save").click();`);
  sleep(5000);
  
  const title = getPageTitle();
  const success = !title.includes("Responder");
  
  return success;
}

export function getPostIdFromUrl(url: string): string {
  const match = url.match(/t=(\d+)/);
  return match ? match[1] : "";
}

export function getFirstPostId(): string {
  const js = `(function(){
    var post = document.querySelector("[id^=post_]");
    if (post) {
      var match = post.id.match(/post_(\\d+)/);
      if (match) return match[1];
    }
    var thanksBtn = document.querySelector("[id^=post_thanks_button_]");
    if (thanksBtn) {
      var match = thanksBtn.id.match(/post_thanks_button_(\\d+)/);
      if (match) return match[1];
    }
    return "";
  })()`;
  
  return runJsInChrome(js);
}

function sleep(ms: number) {
  execSync(`sleep ${ms / 1000}`);
}
