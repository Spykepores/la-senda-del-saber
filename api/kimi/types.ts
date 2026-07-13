export interface KimiUser {
  union_id: string;
  name: string;
  email?: string;
  avatar?: string;
}

export interface KimiTokenPayload {
  id: number;
  unionId: string;
  name: string;
  email?: string | null;
  avatar?: string | null;
  role: string;
}
