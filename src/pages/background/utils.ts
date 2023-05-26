export const getActiveTab = (): Promise<chrome.tabs.Tab> =>
  new Promise((resolve) => {
    chrome.windows.getLastFocused(
      { windowTypes: ["normal"] },
      function (window) {
        chrome.tabs.query(
          { active: true, windowId: window.id },
          function (tabs) {
            const activeTab = tabs[0];
            resolve(activeTab);
          }
        );
      }
    );
  });

type MessageListener = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request: any,
  sender: chrome.runtime.MessageSender,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendResponse: (response?: any) => void
) => void;
type Resolver = (screenshot: string) => void;

/**
 * Returns a listener that will resolve the promise when the screenshot is received
 * It should be run from the background script to listen to messages from the content script
 */
const getListener = (format = "jpeg", resolve: Resolver) => {
  const screenshotListener: MessageListener = (
    request: any,
    sender,
    sendResponse
  ) => {
    if (request.action === "CAPTURE_VISIBLE_TAB") {
      // Capture the screenshot and send it back to the content script
      // this timeout is used because sometimes the screenshot is blank
      // and it starts taking them really fast then chrome throws errors
      // for too many screenshots in a short period of time
      setTimeout(() => {
        if (sender?.tab.windowId) {
          chrome.tabs.captureVisibleTab(
            sender.tab.windowId,
            { format },
            (dataUrl) => {
              sendResponse({ dataUrl: dataUrl });
            }
          );
        }
      }, 1000);

      return true; // Indicates that the response will be sent asynchronously
    } else if (request.action === "SCREENSHOTS_FINISHED") {
      // Handle the screenshots data received from content script
      resolve(request.img);
      // Send a message back to the content script
    }
  };
  return screenshotListener;
};

export const capturePreview = (format = "jpeg"): Promise<string> =>
  new Promise((resolve) => {
    chrome.tabs.captureVisibleTab(null, { format }, (dataUrl) => {
      resolve(dataUrl);
    });
  });

export const captureVisibleTab = (
  tab: chrome.tabs.Tab,
  format = "jpeg"
): Promise<string> =>
  new Promise((resolve) => {
    const listener = getListener(format, resolve);
    chrome.runtime.onMessage.removeListener(listener);
    chrome.runtime.onMessage.addListener(listener);
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, { action: "CAPTURE_SCREENSHOTS" });
    }
  });

type HTMLData = {
  wallets: { name: string; content: string }[];
  html: string;
  text: string;
  contractAddress?: string;
};
export const getTabHTML = async (tab: chrome.tabs.Tab): Promise<HTMLData> => {
  const result = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const eth = document.documentElement.querySelector(
        'meta[name="wallet-address:ethereum"]'
      );
      const contractMetatag = document.documentElement.querySelector(
        'meta[name="content-nft-address"]'
      );
      const wallets = [];
      let contractAddress = null;
      if (eth) {
        wallets.push({
          name: eth.getAttribute("name"),
          content: eth.getAttribute("content"),
        });
      }
      if (contractMetatag) {
        contractAddress = contractMetatag.getAttribute("content");
      }
      return {
        wallets,
        contractAddress,
        html: document.documentElement.outerHTML,
        text: document.documentElement.outerText,
      };
    },
  });

  return result[0].result as HTMLData;
};
