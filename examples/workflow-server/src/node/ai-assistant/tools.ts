/********************************************************************************
 * Copyright (c) 2024 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/
import OpenAI from 'openai';

export const tools: OpenAI.Beta.Assistants.AssistantCreateParams.AssistantToolsFunction[] = [
    {
        type: 'function',
        function: {
            name: 'get_diagram',
            description: 'Returns the current state of the diagram in a JSON format consisting of typed nodes and edges for you.',
            parameters: {}
        }
    },
    {
        type: 'function',
        function: {
            name: 'create_nodes',
            description: 'Creates multiple nodes, each with specified type_id, label, and position',
            parameters: {
                type: 'object',
                properties: {
                    nodes: {
                        type: 'array',
                        description: 'Array of node specifications',
                        items: {
                            type: 'object',
                            properties: {
                                type_id: {
                                    type: 'string',
                                    description: 'Unique identifier for the node type.'
                                },
                                label: {
                                    type: 'string',
                                    description: 'Label for the node.'
                                },
                                position: {
                                    type: 'object',
                                    description: 'Coordinates of the node.',
                                    properties: {
                                        x: {
                                            type: 'number',
                                            description: 'X coordinate of the node.'
                                        },
                                        y: {
                                            type: 'number',
                                            description: 'Y coordinate of the node.'
                                        }
                                    },
                                    required: ['x', 'y']
                                }
                            },
                            required: ['type_id', 'position']
                        }
                    }
                },
                required: ['nodes']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'create_edges',
            description: 'Creates multiple edges, each connecting specified source and target nodes',
            parameters: {
                type: 'object',
                properties: {
                    edges: {
                        type: 'array',
                        description: 'Array of edge specifications',
                        items: {
                            type: 'object',
                            properties: {
                                source_node_id: {
                                    type: 'string',
                                    description: 'The ID of the source node'
                                },
                                target_node_id: {
                                    type: 'string',
                                    description: 'The ID of the target node'
                                }
                            },
                            required: ['source_node_id', 'target_node_id']
                        }
                    }
                },
                required: ['edges']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'delete_nodes',
            description: 'Deletes the nodes with the specified array of node_ids',
            parameters: {
                type: 'object',
                properties: {
                    node_ids: {
                        type: 'array',
                        description: 'Unique identifiers of nodes to be deleted.',
                        items: {
                            type: 'string'
                        }
                    }
                },
                required: ['node_ids']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'move_nodes',
            description: 'Moves the nodes with the specified node_id to the specified position',
            parameters: {
                type: 'object',
                properties: {
                    moves: {
                        type: 'array',
                        description: 'Array of move specifications',
                        items: {
                            node_id: {
                                type: 'string',
                                description: 'Unique identifier of the node to be deleted.'
                            },
                            position: {
                                type: 'object',
                                description: 'New coordinates of the node.',
                                properties: {
                                    x: {
                                        type: 'number',
                                        description: 'X coordinate of the node.'
                                    },
                                    y: {
                                        type: 'number',
                                        description: 'Y coordinate of the node.'
                                    }
                                },
                                required: ['x', 'y']
                            }
                        },
                        required: ['node_id', 'position']
                    }
                },
                required: ['moves']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'delete_edges',
            description: 'Deletes the edges with the specified edge_ids',
            parameters: {
                type: 'object',
                properties: {
                    edge_ids: {
                        type: 'array',
                        description: 'Unique identifiers of the edges to be deleted.',
                        items: {
                            type: 'string'
                        }
                    }
                },
                required: ['edge_ids']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'change_node_labels',
            description: 'Changes the label of the nodes with the specified array of node_id to new_label',
            parameters: {
                type: 'object',
                properties: {
                    renames: {
                        type: 'array',
                        description: 'The array of rename operations',
                        items: {
                            node_id: {
                                type: 'string',
                                description: 'Unique identifier of the node to change the label.'
                            },
                            new_label: {
                                type: 'string',
                                description: 'The new label for the node.'
                            }
                        },
                        required: ['node_id', 'new_label']
                    }
                },
                required: ['renames']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'show_nodes',
            description: 'Centers and selects the node(s) with the specified node_ids',
            parameters: {
                type: 'object',
                properties: {
                    node_ids: {
                        type: 'array',
                        description: 'Unique identifiers of nodes to be centered and selected.',
                        items: {
                            type: 'string'
                        }
                    }
                },
                required: ['node_ids']
            }
        }
    }
];
