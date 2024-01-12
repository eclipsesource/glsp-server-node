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
import { inject, injectable } from 'inversify';
import OpenAI from 'openai';
import { sleep } from 'openai/core';
import { instructions } from './instructions';
// import { DiagramDescriptionProvider } from './model-state-provider';
import { ToolCallHandler } from './tool-call-handler';
import { tools } from './tools';

@injectable()
export class WorkflowDiagramAssistant {
    protected readonly LLM_MODEL_TYPE = 'gpt-4';
    protected readonly INSTRUCTIONS = instructions;
    protected readonly TOOLS = tools;
    protected readonly TIMEOUT_MS = 200000;
    protected readonly POLL_INTERVAL_MS = 2000;

    protected initialized = false;
    protected openAi: OpenAI;
    protected diagramAssistant: OpenAI.Beta.Assistants.Assistant;
    protected diagramAssistantId: string; // = 'asst_0f1VLLmwCtOvkSsdEyADR1vp';
    protected thread: OpenAI.Beta.Threads.Thread;
    protected currentRun: OpenAI.Beta.Threads.Runs.Run;
    protected processedToolCalls: string[] = [];
    protected pollingInterval?: NodeJS.Timer;

    // @inject(DiagramDescriptionProvider)
    // protected diagramDescription: DiagramDescriptionProvider;

    @inject(ToolCallHandler)
    protected toolCallHandler: ToolCallHandler;

    constructor(apiKey: string = 'sk-YOUR_API_KEY') {
        this.openAi = new OpenAI({ apiKey });
    }

    async initialize(): Promise<void> {
        await this.initializeAssistant();
        await this.initializeThread();
    }

    protected async initializeAssistant(): Promise<void> {
        if (this.diagramAssistantId) {
            return;
        }
        this.diagramAssistant = await this.openAi.beta.assistants.create({
            model: this.LLM_MODEL_TYPE,
            instructions: this.INSTRUCTIONS,
            tools: this.TOOLS
        });
        this.diagramAssistantId = this.diagramAssistant.id;
        this.initialized = true;
    }

    protected async initializeThread(): Promise<void> {
        this.thread = await this.openAi.beta.threads.create();
    }

    async sendUserRequest(message: string): Promise<string | undefined> {
        if (!this.initialized) {
            await this.initialize();
        }
        await this.addUserMessageToThread(message);
        this.currentRun = await this.runCurrentThread();
        try {
            await this.waitForCompletionOfCurrentRun();
            const replies = await this.fetchAssistantReplies();
            return replies.length > 0 ? replies[0] : undefined;
        } catch (e) {
            if (e instanceof Error) {
                return e.message;
            }
            return 'I have failed to complete your request.';
        }
    }

    protected async addUserMessageToThread(message: string): Promise<void> {
        // if (this.diagramDescription.containsElements()) {
        //     message = `This is the current diagram state:
        //     \`\`\`json
        //     ${this.diagramDescription.getDescription()}
        //     \`\`\`

        //     ${message}`;
        // }
        await this.openAi.beta.threads.messages.create(this.thread.id, {
            role: 'user',
            content: message
        });
    }

    protected async runCurrentThread(): Promise<OpenAI.Beta.Threads.Runs.Run> {
        return this.openAi.beta.threads.runs.create(this.thread.id, {
            assistant_id: this.diagramAssistantId
        });
    }

    protected async waitForCompletionOfCurrentRun(): Promise<OpenAI.Beta.Threads.Runs.Run> {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const checkCompletion = async () => {
                console.log('Checking completion');
                if (Date.now() - startTime > this.TIMEOUT_MS) {
                    this.stopPollingForResults();
                    reject(new Error('Timeout reached'));
                    this.cancelCurrentUserRequest();
                    return;
                }
                const runStatus = await this.openAi.beta.threads.runs.retrieve(this.thread.id, this.currentRun.id);
                console.log('Received run status', runStatus.status);
                if (runStatus.status === 'requires_action') {
                    this.stopPollingForResults();
                    await this.handleToolCall(runStatus);
                    this.startPollingForResults(checkCompletion);
                } else if (this.isRateLimitExceeded(runStatus)) {
                    this.stopPollingForResults();
                    console.log('Sleeping to wait for rate limit to recover');
                    await sleep(this.POLL_INTERVAL_MS * 3);
                    this.startPollingForResults(checkCompletion);
                } else if (runStatus.status !== 'in_progress' && runStatus.status !== 'queued' && runStatus.status !== 'cancelling') {
                    this.stopPollingForResults();
                    runStatus.status === 'completed' || runStatus.status === 'cancelled'
                        ? resolve(runStatus)
                        : reject(new Error(`Run ended with status: ${runStatus.status}: ${runStatus.last_error?.message}`));
                }
            };
            this.startPollingForResults(checkCompletion);
        });
    }

    private startPollingForResults(checkCompletion: () => Promise<void>): void {
        this.stopPollingForResults();
        this.pollingInterval = setInterval(checkCompletion, this.POLL_INTERVAL_MS);
    }

    private stopPollingForResults(): void {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = undefined;
        }
    }

    protected isRateLimitExceeded(runStatus: OpenAI.Beta.Threads.Runs.Run): boolean {
        return runStatus.status === 'failed' && runStatus.last_error?.code === 'rate_limit_exceeded';
    }

    protected async handleToolCall(runStatus: OpenAI.Beta.Threads.Runs.Run): Promise<void> {
        if (runStatus.required_action?.submit_tool_outputs?.tool_calls[0] === undefined) {
            console.warn('Received invalid tool call', runStatus);
            return;
        }

        const tool_outputs: { tool_call_id: string; output: string }[] = [];
        for (const toolCall of runStatus.required_action.submit_tool_outputs.tool_calls) {
            const toolCallFunctionName = toolCall.function.name;
            const toolCallArgs = JSON.parse(toolCall.function.arguments || '{}');

            let toolCallResponse;
            try {
                toolCallResponse = await this.toolCallHandler.handle(toolCallFunctionName, toolCallArgs);
            } catch (error: any) {
                if (error instanceof Error) {
                    toolCallResponse = { status: 'Error', message: error.message };
                }
                toolCallResponse = { status: 'Error', message: error };
            }
            tool_outputs.push({ tool_call_id: toolCall.id, output: JSON.stringify(toolCallResponse) });
        }

        try {
            await this.openAi.beta.threads.runs.submitToolOutputs(this.thread.id, this.currentRun.id, { tool_outputs });
        } catch (error: any) {
            console.error('Providing tool output failed', error);
        }
    }

    protected async fetchAssistantReplies(): Promise<string[]> {
        const messages = await this.openAi.beta.threads.messages.list(this.thread.id);
        return messages.data
            .filter(message => message.role === 'assistant')
            .map(message => message.content)
            .flatMap(content => content.filter(messagePart => messagePart.type === 'text'))
            .map(textContent => (textContent as { text: { value: string } }).text.value);
    }

    async cancelCurrentUserRequest(): Promise<void> {
        this.stopPollingForResults();
        if (this.currentRun) {
            try {
                await this.openAi.beta.threads.runs.cancel(this.thread.id, this.currentRun.id);
            } catch (e) {
                console.warn(e);
            }
        }
    }

    async terminate(): Promise<void> {
        await this.openAi.beta.threads.del(this.thread.id);
        if (this.diagramAssistant) {
            await this.openAi.beta.assistants.del(this.diagramAssistant.id);
        }
        this.initialized = false;
    }
}
