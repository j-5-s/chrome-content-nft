import reloadOnUpdate from "virtual:reload-on-update-in-background-script";
import { Logger } from "@src/common/logger/logger";
import { ChromeStorageLocal } from "./store";
import { calculateSHA256 } from "../../common/crypto/calculateSha";
import { getActiveTab, captureVisibleTab, getTabHTML } from "./utils";
import { uploadToPinata } from "../../common/crypto/pinata/pinata";
import { Settings } from "@src/types";

type SettingsSlice = {
  settings: Settings;
};
const konsole = Logger.getInstance();
reloadOnUpdate("pages/background");

/**
 * Extension reloading is necessary because the browser automatically caches the css.
 * If you do not use the css of the content script, please delete it.
 */
reloadOnUpdate("pages/content/style.scss");

const ports = new Map();
const store = new ChromeStorageLocal("state");

const publish = (msg) => {
  konsole.log("publish", msg);
  ports.forEach((port) => {
    port.postMessage(msg);
  });
};

chrome.runtime.onConnect.addListener(function (port) {
  konsole.log("onConnect", port);
  if (port.sender?.tab?.id) {
    ports.set(port.sender?.tab?.id, port);
  } else {
    ports.set(port.name, port);
  }

  port.onDisconnect.addListener(function (port) {
    konsole.log("onDisconnect", port);
    if (port.sender?.tab?.id) {
      ports.delete(port.sender?.tab?.id);
    } else {
      ports.delete(port.name);
    }
  });

  port.onMessage.addListener(function (msg) {
    konsole.log("onMessage", msg);
    if (msg.type === "initialState") {
      store.getState().then((state) => {
        konsole.log("initialState", msg.initialValue, state);
        publish({
          type: msg.type,
          value: state?.[msg.key] || msg.initialValue,
          key: msg.key,
          ack: true,
        });
      });
    }
    if (msg.type === "setState") {
      store.updateState(msg.key, msg.value).then(() => {
        publish({
          type: msg.type,
          value: msg.value,
          key: msg.key,
          ack: true,
        });
      });
    }

    if (msg.type === "createNFT") {
      (async () => {
        try {
          const tab = await getActiveTab();
          const image = await captureVisibleTab(tab);
          const { html, wallets, contractAddress } = await getTabHTML(tab);
          const textSHA256 = await calculateSHA256(html);
          const imageSHA256 = await calculateSHA256(image);
          const ts = new Date().getTime();
          const { settings } = await store.getState<SettingsSlice>();

          const metadata = {
            attributes: [
              {
                trait_type: "Title",
                value: tab.title,
              },
              {
                trait_type: "URL",
                value: tab.url,
              },
              {
                trait_type: "Timestamp",
                value: ts,
              },
              {
                trait_type: "Text SHA 256",
                value: textSHA256,
              },
              {
                trait_type: "Image SHA 256",
                value: imageSHA256,
              },
            ],
            description: `The copyright verification for ${tab.url}`,
            image: "",
            name: `${tab.title} - ${tab.url} - ${ts}`,
          };

          try {
            // @todo get api keys from ui
            const { IpfsHash } = await uploadToPinata({
              pinataApiKey: settings.pinataApiKey,
              pinataSecretApiKey: settings.pinataApiSecret,
              base64Image: image,
            });

            metadata.image = `ipfs://${IpfsHash}`;
            const response = await uploadToPinata({
              pinataApiKey: settings.pinataApiKey,
              pinataSecretApiKey: settings.pinataApiSecret,
              jsonData: JSON.stringify(metadata),
            });
            // https://nft.j5s.dev/mint?ipfsHash=Qmc2fCaDqSBr1jXzDgTZYHQt1VwKh1DrxTgk1W8U1xPodo&contractAddress=0x19d8ed9987102e2fbfe8e0710e1c38a0ed202f64&wallet=wallet-address:ethereum::0x66c2801e144A0BA4d7F6aFF62f535F312aaF609a
            const params = [];
            params.push(`ipfsHash=${response.IpfsHash}`);
            params.push(`contractAddress=${contractAddress}`);
            wallets.forEach((wallet) => {
              params.push(`wallet=${wallet.name}::${wallet.content}`);
            });
            const queryString = params.join("&");
            const url = `https://nft.j5s.dev/mint?${queryString}`;
            konsole.log(url);
            chrome.tabs.create({
              url,
            });
          } catch (ex) {
            konsole.log(ex);
            throw ex;
          }
        } catch (ex) {
          konsole.log(ex);
          throw ex;
        }
      })();
    }

    if (msg.type === "popupInit") {
      (async () => {
        const tab = await getActiveTab();
        const { contractAddress } = await getTabHTML(tab);
        const key = "page";
        const value = { contractAddress };
        await store.updateState(key, value);
        publish({
          type: "setState",
          value,
          key,
          ack: true,
        });
        konsole.log("state updated and published");
      })();
    }
  });
});
