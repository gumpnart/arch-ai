import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "../components/Settings/SettingsPage.js";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});
