import { useEffect } from "react";
import { Toaster, sileo } from "sileo";
import { toCleanMessage, detectMessageType } from "../lib/notify";

function installWebAlertOverride() {
  if (typeof window === "undefined") return;
  if (window.__microshaAlertInstalled) return;

  window.__microshaOriginalAlert = window.alert;
  window.alert = (message) => {
    const text = toCleanMessage(message);
    const type = detectMessageType(text);

    if (type === "success") {
      sileo.success({ title: text });
    } else if (type === "warning") {
      sileo.warning({ title: text });
    } else if (type === "error") {
      sileo.error({ title: text });
    } else {
      sileo.info({ title: text });
    }
  };
  window.__microshaAlertInstalled = true;
}

export default function WebAlertHost() {
  useEffect(() => {
    installWebAlertOverride();
  }, []);

  return <Toaster position="top-center" theme="dark" />;
}
