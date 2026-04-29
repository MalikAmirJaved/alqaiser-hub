// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import CrudPage from "../components/CrudPage";
import { schemas } from "../config/schemas";

export const Route = createFileRoute("/_app/finance/assets")({
  component: () => <CrudPage {...schemas.financeAssets} />,
});
