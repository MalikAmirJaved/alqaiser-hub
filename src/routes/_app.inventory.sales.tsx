// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import CrudPage from "../components/CrudPage";
import { schemas } from "../config/schemas";

export const Route = createFileRoute("/_app/inventory/sales")({
  component: () => <CrudPage {...schemas.salesOrders} />,
});
