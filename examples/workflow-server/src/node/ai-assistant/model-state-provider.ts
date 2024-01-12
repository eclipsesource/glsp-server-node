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

import { GModelRoot, ModelState } from '@eclipse-glsp/server';
import { inject, injectable } from 'inversify';

@injectable()
export class DiagramDescriptionProvider {
    @inject(ModelState)
    protected modelState: ModelState;

    containsElements(): boolean {
        return this.modelState.root.children.length > 0;
    }

    getDescription(): string {
        return this.convertModelState(this.modelState.root);
    }

    protected convertModelState(root: GModelRoot): string {
        return JSON.stringify(this.getModelState(root));
    }

    getModelState(root: GModelRoot): any {
        function processElement(node: any): any | null {
            if (
                ![
                    'task:manual',
                    'task:automated',
                    'activityNode:decision',
                    'activityNode:merge',
                    'activityNode:fork',
                    'activityNode:join',
                    'edge',
                    'edge:weighted'
                ].includes(node.type)
            ) {
                // eslint-disable-next-line no-null/no-null
                return null;
            }

            // Process edge type directly
            if (node.type === 'edge' || node.type === 'edge:weighted') {
                return {
                    id: node.id,
                    type: node.type,
                    sourceId: node.sourceId,
                    targetId: node.targetId
                };
            }

            // Process other node types and look for label:heading
            const newNode = {
                type: node.type,
                id: node.id,
                label: undefined,
                position: undefined,
                size: undefined
            };
            if (node.children) {
                for (const child of node.children) {
                    if (child.type === 'label:heading') {
                        newNode.label = child.text;
                        break;
                    }
                }
            }
            if (node.position) {
                newNode.position = node.position;
            }
            if (node.size) {
                newNode.size = node.size;
            }

            return newNode;
        }
        const convertedModel = {
            ...root,
            // eslint-disable-next-line no-null/no-null
            children: root.children.map(processElement).filter((node: any) => node !== null)
        };
        return convertedModel;
    }
}
