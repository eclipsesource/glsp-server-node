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

import {
    ActionDispatcher,
    ApplyLabelEditOperation,
    CenterAction,
    ChangeBoundsOperation,
    CreateEdgeOperation,
    CreateNodeOperation,
    DeleteElementOperation,
    ModelState,
    SelectAction,
    isGBoundsAware
} from '@eclipse-glsp/server';
import { inject, injectable } from 'inversify';
import { DiagramDescriptionProvider } from './model-state-provider';

export interface ToolCallResult {
    status: 'OK' | 'Error';
    nodes?: { id: string; label: string }[];
    edges?: { id: string; source_node_id: string; target_node_id: string }[];
    diagram?: any;
}

@injectable()
export class ToolCallHandler {
    @inject(ActionDispatcher)
    protected actionDispatcher: ActionDispatcher;

    @inject(ModelState)
    protected modelState: ModelState;

    @inject(DiagramDescriptionProvider)
    protected diagramDescription: DiagramDescriptionProvider;

    async handle(functionName: string, args: any): Promise<ToolCallResult> {
        switch (functionName) {
            case 'get_diagram':
                return this.handleGetDiagram(args);
            case 'create_nodes':
                return this.handleCreateNodes(args);
            case 'create_edges':
                return this.handleCreateEdges(args);
            case 'delete_nodes':
                return this.handleDeleteNodes(args);
            case 'delete_edges':
                return this.handleDeleteEdges(args);
            case 'move_nodes':
                return this.handleMoveNodes(args);
            case 'change_node_labels':
                return this.handleChangeNodeLabels(args);
            case 'show_nodes':
                return this.showNodes(args);
            default:
                return { status: 'Error' };
        }
    }

    async handleGetDiagram(args: any): Promise<ToolCallResult> {
        return { status: 'OK', diagram: this.diagramDescription.getModelState(this.modelState.root) };
    }

    async handleCreateNodes(args: any): Promise<ToolCallResult> {
        const nodes = [];
        for (const nodeToCreate of args.nodes) {
            const allIds = this.modelState.index.allIds();
            const location = nodeToCreate.position;
            await this.actionDispatcher.dispatch(CreateNodeOperation.create(nodeToCreate.type_id, { location }));
            const newIds = this.modelState.index.allIds().filter(id => !allIds.includes(id));
            if (nodeToCreate.label && newIds[2]) {
                await this.actionDispatcher.dispatch(
                    ApplyLabelEditOperation.create({
                        labelId: newIds[2],
                        text: nodeToCreate.label
                    })
                );
            }
            nodes.push({ id: newIds[0], label: nodeToCreate.label });
        }

        return { status: 'OK', nodes };
    }

    async handleDeleteNodes(args: any): Promise<ToolCallResult> {
        await this.actionDispatcher.dispatch(DeleteElementOperation.create(args.node_ids));
        return { status: 'OK' };
    }

    async handleCreateEdges(args: any): Promise<ToolCallResult> {
        const edges = [];
        for (const edgeToCreate of args.edges) {
            const allIds = this.modelState.index.allIds();
            const { source_node_id, target_node_id } = edgeToCreate;
            await this.actionDispatcher.dispatch(
                CreateEdgeOperation.create({
                    elementTypeId: edgeToCreate.type_id ?? 'edge',
                    sourceElementId: edgeToCreate.source_node_id,
                    targetElementId: edgeToCreate.target_node_id
                })
            );
            const newIds = this.modelState.index.allIds().filter(id => !allIds.includes(id));
            edges.push({ id: newIds[0], source_node_id, target_node_id });
        }
        return { status: 'OK', edges };
    }

    async handleDeleteEdges(args: any): Promise<ToolCallResult> {
        await this.actionDispatcher.dispatch(DeleteElementOperation.create(args.edge_ids));
        return { status: 'OK' };
    }

    async handleMoveNodes(args: any): Promise<ToolCallResult> {
        const moveOperations = [];
        const moves: { node_id: string; position: { x: number; y: number } }[] = args.moves;

        for (const move of moves) {
            const node = this.modelState.index.find(move.node_id);
            if (!node || !isGBoundsAware(node)) {
                return { status: 'Error' };
            }
            moveOperations.push({
                elementId: move.node_id,
                newSize: node.size!,
                newPosition: {
                    x: move.position.x,
                    y: move.position.y
                }
            });
        }

        await this.actionDispatcher.dispatch(ChangeBoundsOperation.create(moveOperations));
        return { status: 'OK' };
    }

    async handleChangeNodeLabels(args: any): Promise<ToolCallResult> {
        const operations = [];
        for (const rename of args.renames) {
            const label = this.modelState.index.find(rename.node_id)?.children[1];
            if (!label) {
                return { status: 'Error' };
            }
            operations.push(
                ApplyLabelEditOperation.create({
                    labelId: label.id,
                    text: rename.new_label
                })
            );
        }
        await this.actionDispatcher.dispatchAll(operations);
        return { status: 'OK' };
    }

    async showNodes(args: any): Promise<ToolCallResult> {
        const ids: string[] = [];
        ids.push(...args.node_ids);
        for (const id of ids) {
            if (!this.modelState.index.find(id)) {
                return { status: 'Error' };
            }
        }
        const toBeDeselected = this.modelState.index.allIds().filter(anId => !ids.includes(anId));
        await this.actionDispatcher.dispatchAll([
            CenterAction.create(ids),
            SelectAction.create({ selectedElementsIDs: ids, deselectedElementsIDs: toBeDeselected })
        ]);
        return { status: 'OK' };
    }
}
