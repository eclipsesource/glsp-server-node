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
import { Action, ActionDispatcher, ActionHandler, MaybePromise } from '@eclipse-glsp/server';
import { inject, injectable } from 'inversify';
import { AiAssistantCancelAction, AiAssistantRequestAction, AiAssistantResponseAction } from './actions';
import { WorkflowDiagramAssistant } from './assistant';

@injectable()
export class AiAssistantRequestActionHandler implements ActionHandler {
    actionKinds = [AiAssistantRequestAction.KIND, AiAssistantCancelAction.KIND];

    @inject(WorkflowDiagramAssistant) protected assistant: WorkflowDiagramAssistant;
    @inject(ActionDispatcher) protected actionDispatcher: ActionDispatcher;

    execute(action: Action, ...args: unknown[]): MaybePromise<Action[]> {
        if (AiAssistantRequestAction.is(action)) {
            this.assistant.sendUserRequest(action.message).then(
                message => this.replyToRequest(message, action.requestId),
                reason => console.error('AI Assistant request failed', reason)
            );
        } else if (AiAssistantCancelAction.is(action)) {
            this.assistant.cancelCurrentUserRequest();
        }
        return [];
    }

    private replyToRequest(message: string | undefined, responseId: string): any {
        return this.actionDispatcher.dispatch(AiAssistantResponseAction.create(message ?? 'Done', { responseId }));
    }
}
