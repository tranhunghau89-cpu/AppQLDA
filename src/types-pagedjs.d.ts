declare module "pagedjs" {
  export class Previewer {
    preview(
      content: string | Node,
      stylesheets: (string | Record<string, string>)[],
      renderTo: HTMLElement,
    ): Promise<unknown>;
  }
}
