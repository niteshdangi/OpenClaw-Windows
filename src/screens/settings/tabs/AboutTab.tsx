import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  Spinner,
  Text,
  tokens,
  makeStyles,
  Image,
} from "@fluentui/react-components";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: "16px",
    padding: "32px 24px",
    maxWidth: "480px",
    margin: "0 auto",
  },
  icon: {
    width: "120px",
    height: "120px",
    borderRadius: "22px",
    backgroundColor: tokens.colorBrandBackground,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "64px",
    cursor: "pointer",
    transition: "transform 0.2s, box-shadow 0.2s",
  },
  title: {
    fontSize: tokens.fontSizeBase600,
    fontWeight: tokens.fontWeightBold,
  },
  version: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase300,
  },
  description: {
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
    textAlign: "center",
    maxWidth: "340px",
  },
  divider: {
    width: "100%",
    height: "1px",
    backgroundColor: tokens.colorNeutralStroke2,
    margin: "4px 0",
  },
  footer: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground4,
    textAlign: "center",
  },
  utilityRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    justifyContent: "center",
  },
});

interface BuildInfo {
  version: string;
  gitCommit?: string;
  buildTimestamp?: string;
}

export function AboutTab() {
  const styles = useStyles();
  const [info, setInfo] = useState<BuildInfo>({ version: "..." });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke<BuildInfo>("get_build_info")
      .then(setInfo)
      .catch((error) => {
        console.error("get_build_info failed", error);
      })
      .finally(() => setLoading(false));
  }, []);

  const openExternal = (url: string) =>
    openUrl(url).catch((error) => {
      console.error(`Failed to open URL: ${url}`, error);
    });

  if (loading) return <Spinner size="small" label="Loading..." />;

  // Show short commit hash when build metadata includes gitCommit.
  const versionLabel = info.gitCommit
    ? `${info.version} (${info.gitCommit.slice(0, 8)})`
    : info.version;

  const buildLabel = info.buildTimestamp
    ? `Built ${new Date(info.buildTimestamp).toLocaleDateString()}`
    : null;

  return (
    <div className={styles.root}>
      <Image
        src="/assets/openclaw-mac.png"
        alt="OpenClaw Icon"
        className={styles.icon}
        onClick={() =>
          openExternal("https://github.com/niteshdangi/openclaw-windows")
        }
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "3px",
        }}
      >
        <Text className={styles.title}>OpenClaw</Text>
        <Text className={styles.version}>Version {versionLabel}</Text>
        {buildLabel && <Text className={styles.version}>{buildLabel}</Text>}
      </div>
      <div className={styles.divider} />

      <div style={{ marginTop: "auto" }}>
        <Text className={styles.footer}>
          Copyright 2025 Nitesh Dangi - MIT License.
        </Text>
      </div>
    </div>
  );
}
