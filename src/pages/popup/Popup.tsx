import React, { useContext, useEffect } from "react";
import { MsgContext } from "../../common/msg/MsgContext";
import type { IMsgContext } from "../../common/msg/MsgContext";
import { usePersistedState } from "../../common/msg/usePersistedState";

type PageState = {
  contractAddress?: string;
};
const Popup: React.FC = () => {
  const { value } = usePersistedState<PageState>("page", {});
  const msgContext = useContext<IMsgContext>(MsgContext);

  const metaTag = `<meta name="wallet-address" content="${
    value?.contractAddress || ""
  }"/>`;

  const handleClickCreateNFT = () => {
    msgContext.connection.postMessage({ type: "createNFT" });
  };

  useEffect(() => {
    msgContext.connection.postMessage({ type: "popupInit" });
  }, [msgContext.connection]);

  return (
    <div className="App">
      <div className="flex flex-col h-screen">
        <div className="border flex-1">
          <div className="p-4">
            <h1 className="text-2xl mb-2">Content NFT creator</h1>
            <ol className="list-decimal ml-4">
              <li className="mb-1">
                <div>
                  Add a metatag with your wallet address to a web page like
                  below:
                </div>
                <div className=" border-gray-300 border-2 flex">
                  <textarea
                    value={metaTag}
                    className="w-full text-xs p-2 resize-none"
                    disabled
                  />
                </div>
              </li>
              <li className="mb-1">Browse to a url that you created.</li>
              <li className="mb-1">Click &quot;Create NFT&quot; below</li>
            </ol>
          </div>
        </div>
        <div className="border-t-1 p-4">
          <button
            onClick={handleClickCreateNFT}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full"
          >
            Create NFT
          </button>
        </div>
      </div>
    </div>
  );
};

export default Popup;
