interface Argument {
    type: string,
    definition?: unknown
}

interface Trigger {
    type: string,
    definition?: unknown
}

export interface JobDefinition {
    runType: string
    name?: string
    triggers?: [Trigger]
    arguments?: [Argument]
}

export interface PipelineDefinition {
    triggers: [string],
    steps: [string]
}

export interface ArgumentRequest<Definition = unknown> {
    event: unknown,
    definition?: Definition,
    handlers: Record<string, (request: ArgumentRequest) => unknown>
}

export interface TriggerRequest<Definition = unknown> {
    event: unknown,
    definition?: Definition,
    handlers: Record<string, (request: TriggerRequest) => boolean>
}

export interface RunHandlerRequest<Arguments = unknown> {
    args: Arguments,
    job: JobDefinition,
    name: string,
    pastResults: unknown[],
    event: unknown,
    config: Record<string, unknown>
}

export interface LimitlessConfig {
    jobDefinitions?: JobDefinition[],
    pipelineDefinitions?: PipelineDefinition[],
    config?: Record<string, unknown>,
    argumentHandlers?: Record<string, (request: ArgumentRequest) => unknown>,
    runHandlers?: Record<string, (request: RunHandlerRequest) => unknown>,
    triggerHandlers?: Record<string, (request: TriggerRequest) => boolean>,
}

export class Limitless {
    readonly jobDefinitions: JobDefinition[]
    readonly pipelineDefinitions: PipelineDefinition[]
    readonly config: Record<string, unknown>
    readonly argumentHandlers: Record<string, (request: ArgumentRequest) => unknown>
    readonly runHandlers: Record<string, (request: RunHandlerRequest) => unknown>
    readonly triggerHandlers: Record<string, (request: TriggerRequest) => boolean>

    constructor(config?: LimitlessConfig) {
        this.pipelineDefinitions = config?.pipelineDefinitions ?? [];
        this.config = config?.config ?? {};
        this.argumentHandlers = config?.argumentHandlers ?? {};
        this.runHandlers = config?.runHandlers ?? {};
        this.triggerHandlers = config?.triggerHandlers ?? {};
        this.jobDefinitions = config?.jobDefinitions ?? [];
        this.jobDefinitions.forEach(job => this.registerDefinition(job))
        return this
    }

    private registerDefinition(newJob: JobDefinition): JobDefinition {
        if (!newJob.triggers)
            return newJob

        newJob.triggers.filter(({type}) =>
            BUILTIN_TRIGGERS.has(type) && !this.triggerHandlers[type]
        ).forEach(({type}) =>
            this.withTriggerHandler(type, Builtin.triggerHandlers[type])
        )
        return newJob
    }

    private apply(job: JobDefinition, name: string, event: unknown, pastResults: unknown[]): unknown {
        const args = !job.arguments ? event : job.arguments.reduce((previousValue, {type, definition}) => {
            const handler = orDefault(this.argumentHandlers, Builtin.argumentHandlers, type)
            return handler({event: previousValue, definition, handlers: this.argumentHandlers,} as ArgumentRequest)
        }, event)

        const runHandler = orDefault(this.runHandlers, Builtin.runHandlers, job.runType)
        return runHandler({args, job, name, pastResults, event, config: this.config,})
    }

    withConfig(additionalConfig: Record<string, unknown>): Limitless {
        for (const key in additionalConfig) {
            this.config[key] = additionalConfig[key]
        }
        return this
    }

    withJobDefinition(newJob: JobDefinition): Limitless {
        this.jobDefinitions.push(this.registerDefinition(newJob))
        return this
    }

    withPipeline(pipeline: PipelineDefinition): Limitless {
        this.pipelineDefinitions.push(pipeline)
        return this
    }

    withArgumentHandler<Definition>(name: string, action: (request: ArgumentRequest<Definition>) => unknown): Limitless {
        this.argumentHandlers[name] = action as (request: ArgumentRequest) => unknown
        return this
    }

    withRunHandler<Arguments>(name: string, action: (request: RunHandlerRequest<Arguments>) => unknown): Limitless {
        this.runHandlers[name] = action as (request: RunHandlerRequest) => unknown
        return this
    }

    withTriggerHandler<Definition>(name: string, action: (request: TriggerRequest<Definition>) => boolean): Limitless {
        this.triggerHandlers[name] = action as (request: TriggerRequest) => boolean
        return this
    }

    process(...events: any[]): any[] {
        const allDefinitions = this.jobDefinitions.map((jobDefinition, index) => {
            return {
                name: jobDefinition.name || `job-${index}`,
                jobDefinition,
            }
        })

        const jobLookup = allDefinitions.reduce((result: Record<string, JobDefinition>, {name, jobDefinition}) => {
            result[name] = jobDefinition
            return result
        }, {})

        return events.reduce((returnValues, event) =>
            [...returnValues, ...allDefinitions
                .filter(({jobDefinition}) =>
                    Object.keys(this.triggerHandlers).length === 0 ||
                    Builtin.triggerHandlers.__any({
                        definition: jobDefinition.triggers,
                        event,
                        handlers: this.triggerHandlers,
                    } as TriggerRequest))
                .map(({name, jobDefinition}) =>
                    this.pipelineDefinitions
                        .filter(pipeline =>
                            pipeline.triggers.includes(name))
                        .reduce((result, definition) =>
                                definition.steps.reduce((result, jobName) =>
                                        this.apply(jobLookup[jobName], jobName, result, returnValues),
                                    result),
                            this.apply(jobDefinition, name, event, returnValues))),], [])
    }

    static create(config?: LimitlessConfig): Limitless {
        return new Limitless(config)
    }
}

function orDefault<T>(handlers: Record<string, T>, builtins: Record<string, T>, type: string): T {
    return handlers[type] || builtins[type]
}

const Builtin = {
    argumentHandlers: {
        __fromJson: ({event,}: ArgumentRequest): unknown => JSON.parse(event as string),
        __fromRegex: ({event, definition,}: ArgumentRequest<string>): Array<string> | null => {
            const regexMatch = (event as string).match(new RegExp(definition as string))
            return regexMatch && regexMatch.length > 1 ? regexMatch.slice(1) : null
        },
        __keyword: ({event, definition, handlers: argumentHandlers}: ArgumentRequest<Record<string, Argument>>): unknown => {
            if (!definition)
                return {}

            return Object.entries(definition).reduce((previousValue: Record<string, unknown>, [key, value]) => {
                const {type, definition} = value as Argument
                const handler = orDefault(argumentHandlers, Builtin.argumentHandlers, type)
                previousValue[key] = handler({event, definition, handlers: argumentHandlers,})
                return previousValue
            }, {})
        },
        __positional: ({event, definition, handlers: argumentHandlers}: ArgumentRequest<Array<Argument>>): Array<unknown> => {
            if (!definition)
                return []

            return definition.map(({type, definition}) => {
                const handler = orDefault(argumentHandlers, Builtin.argumentHandlers, type)
                return handler({event, definition, handlers: argumentHandlers,})
            })
        },
        __env: ({definition,}: ArgumentRequest<string>): unknown => {
            return process.env[definition!]
        },
        __value: ({definition,}: ArgumentRequest<string>): unknown => {
            return definition
        },
    } as Record<string, (request: ArgumentRequest) => unknown>,
    runHandlers: {
        __identity: ({args,}: RunHandlerRequest) => args,
        __toJson: ({args,}: RunHandlerRequest) => JSON.stringify(args),
    } as Record<string, (request: RunHandlerRequest) => unknown>,
    triggerHandlers: {
        __all: ({definition, event, handlers}: TriggerRequest<Array<Trigger>>): boolean => {
            if (!definition)
                return true

            return definition.reduce((previousValue: boolean, {type, definition}) =>
                previousValue && handlers[type]({definition, event, handlers,}), true)
        },
        __any: ({definition, event, handlers}: TriggerRequest<Array<Trigger>>): boolean => {
            if (!definition)
                return false

            return definition.reduce((previousValue: boolean, {type, definition}) =>
                previousValue || handlers[type]({definition, event, handlers,}), false)
        },
        __not: ({definition, event, handlers}: TriggerRequest<Trigger>): boolean => {
            if (!definition)
                return false

            return !handlers[definition.type]({definition, event, handlers,})
        },
        __regex: ({definition, event,}: TriggerRequest<string>): boolean => {
            const match = (event as string).match(new RegExp(definition as string))
            if(!match)
                return false
            return match.length > 0
        }
    } as Record<string, (request: TriggerRequest) => boolean>,
}

const BUILTIN_TRIGGERS = new Set(Object.keys(Builtin.triggerHandlers))