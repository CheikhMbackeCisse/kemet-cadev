// better-auth déclare vitest comme pair optionnel (pour ses utilitaires de
// test, que l'on n'importe pas). Résolu sur le vitest de développement de
// apps/server, il faisait entrer vitest, vite et tinypool dans l'image de
// production de l'API par `pnpm deploy --prod`.
function readPackage(pkg) {
  if (pkg.name === "better-auth") {
    delete pkg.peerDependencies?.vitest;
    delete pkg.peerDependenciesMeta?.vitest;
  }
  return pkg;
}

module.exports = { hooks: { readPackage } };
