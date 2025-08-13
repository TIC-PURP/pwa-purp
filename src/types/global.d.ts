// Extra typings (no conflict with @types)
declare module 'bcryptjs' {
  const bcrypt: {
    hash(data: string, saltOrRounds: number | string): Promise<string>;
    compare(data: string, encrypted: string): Promise<boolean>;
    genSaltSync(rounds?: number): string;
    hashSync(data: string, salt: string | number): string;
    compareSync(data: string, encrypted: string): boolean;
  };
  export default bcrypt;
}
