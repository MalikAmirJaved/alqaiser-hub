
// @ts-nocheck
"use client";

import dynamic from "next/dynamic";
const CrudPage = dynamic(() => import("@/components/CrudPage"), { ssr: false });
import { schemas } from "@/config/schemas";

export default () => <CrudPage {...schemas.attendance} />;

