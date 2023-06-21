import c from 'picocolors'
import type { TaskResultPack } from '@vitest/runner'
import type { UserConsoleLog } from '../../types/general'
import type { Vitest } from '../core'
import { BaseReporter } from './base'
import type { ListRendererOptions } from './renderers/listRenderer'
import { createListRenderer } from './renderers/listRenderer'

export class DefaultReporter extends BaseReporter {
  renderer!: ReturnType<typeof createListRenderer>
  rendererOptions: ListRendererOptions = {} as any
  private renderSucceedDefault?: boolean

  constructor() {
    super()
  }

  onInit(ctx: Vitest): void {
    super.onInit(ctx)
    this.rendererOptions.logger = this.ctx.logger
    this.rendererOptions.showHeap = this.ctx.config.logHeapUsage
    this.rendererOptions.mode = this.mode
    this.renderer = createListRenderer([], this.rendererOptions)
  }

  onPathsCollected(paths: string[] = []) {
    if (this.isTTY) {
      if (this.renderSucceedDefault === undefined)
        this.renderSucceedDefault = !!this.rendererOptions.renderSucceed

      if (this.renderSucceedDefault !== true)
        this.rendererOptions.renderSucceed = paths.length <= 1
    }
  }

  onTaskUpdate(packs: TaskResultPack[]) {
    if (this.isTTY)
      this.renderer.update()
    super.onTaskUpdate(packs)
  }

  async onTestRemoved(trigger?: string) {
    this.ctx.logger.clearScreen(c.yellow('Test removed...') + (trigger ? c.dim(` [ ${this.relative(trigger)} ]\n`) : ''), true)
    const files = this.ctx.state.getFiles(this.watchFilters)
    this.renderer.print()
    this.ctx.logger.log()
    await super.reportSummary(files, this.ctx.state.getUnhandledErrors())
    super.onWatcherStart()
  }

  onCollected() {
    if (this.isTTY) {
      const files = this.ctx.state.getFiles(this.watchFilters)
      this.renderer.updateFiles(files)
    }
  }

  async onFinished(files = this.ctx.state.getFiles(), errors = this.ctx.state.getUnhandledErrors()) {
    this.renderer.print()
    this.ctx.logger.log()
    await super.onFinished(files, errors)
  }

  async onWatcherRerun(files: string[], trigger?: string) {
    await this.renderer.print()
    await super.onWatcherRerun(files, trigger)
  }

  onUserConsoleLog(log: UserConsoleLog) {
    if (!this.shouldLog(log))
      return
    this.renderer.clear()
    super.onUserConsoleLog(log)
  }
}
