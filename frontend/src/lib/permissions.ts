// lib/permissions.ts

export type PermissionActions = {
  create: boolean;
  view: boolean;
  update: boolean;
  delete: boolean;
  export: boolean;
  approve: boolean;
  reject: boolean;
  assign: boolean;
  publish: boolean;
  archive: boolean;
};

export const getPermissions = (
  permissions: string[],
  module: string,
  feature: string
): PermissionActions => {
  const prefix = `${module}:${feature}:`;

  return {
    create: permissions.includes(`${prefix}create`),
    view: permissions.includes(`${prefix}view`),
    update: permissions.includes(`${prefix}update`),
    delete: permissions.includes(`${prefix}delete`),
    export: permissions.includes(`${prefix}export`),
    approve: permissions.includes(`${prefix}approve`),
    reject: permissions.includes(`${prefix}reject`),
    assign: permissions.includes(`${prefix}assign`),
    publish: permissions.includes(`${prefix}publish`),
    archive: permissions.includes(`${prefix}archive`),
  };
};