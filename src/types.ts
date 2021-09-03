export type RoamQPullBlock = {
  attrs?: { source: string[]; value: string | [string, string] }[][];
  children?: RoamQPullBlock[];
  id?: number;
  string?: string;
  title?: string;
  heading?: number;
  open?: boolean;
  time?: number;
  uid?: string;
  order?: number;
};
