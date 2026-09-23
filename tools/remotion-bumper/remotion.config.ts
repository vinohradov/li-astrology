import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// H.264, good quality for Instagram upload.
Config.setCodec("h264");
Config.setCrf(18);
