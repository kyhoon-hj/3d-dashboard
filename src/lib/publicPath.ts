const proxiedBasePath = "/dashboard";

export function publicPath(path: `/${string}`) {
  if (typeof window === "undefined") {
    return path;
  }

  const currentPath = window.location.pathname;
  const isDashboardProxy =
    currentPath === proxiedBasePath || currentPath.startsWith(`${proxiedBasePath}/`);

  return isDashboardProxy ? `${proxiedBasePath}${path}` : path;
}
