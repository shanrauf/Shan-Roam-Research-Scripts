type NodeEdgeType = 'none' | 'undirected' | 'directed' | 'inverted-directed';

type GraphSettings = {
  connections: {
    'node-to-children': NodeEdgeType;
    'node-to-ref-nodes': NodeEdgeType;
    'node-to-backlinks': NodeEdgeType;
    'node-to-immediate-siblings': NodeEdgeType;
  };
  special: {
    'replace-node-with-ref-nodes': boolean;
    'label-edges-with-attributes': boolean;
  };
};
