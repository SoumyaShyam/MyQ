declare module 'convict' {
  interface Config<T> {
    load(values: unknown): void;
    validate(options: { allowed: 'strict' }): void;
    getProperties(): T;
  }
  function convict<T>(schema: unknown): Config<T>;
  export default convict;
}