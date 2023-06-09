import c from 'picocolors'
import type { TaskResultPack } from '@vitest/runner'
import type { UserConsoleLog } from '../../types/general'
import { BaseReporter } from './base'
import type { ListRendererOptions } from './renderers/listRenderer'
import { createListRenderer } from './renderers/listRenderer'

export class DefaultReporter extends BaseReporter {
  renderer?: ReturnType<typeof createListRenderer>
  rendererOptions: ListRendererOptions = {} as any
  timer: ReturnType<typeof setTimeout> | null = null

  constructor() {
    super()
    this.wrapStdio(process.stdout)
    this.wrapStdio(process.stdin)
  }

  protected wrapStdio(
    stream: NodeJS.WritableStream | NodeJS.WriteStream,
  ) {
    const write = stream.write.bind(stream)

    let buffer: Array<string> = []
    let timeout: NodeJS.Timeout | null = null

    const flushBufferedOutput = () => {
      const bufferString = buffer.join('')
      buffer = []

      // This is to avoid conflicts between random output and status text
      this.removeTestSummary()
      if (bufferString)
        write(bufferString)

      this.reportRunningSummary(this.ctx.state.getFiles(this.watchFilters))
    }

    const debouncedFlush = () => {
      // If the process blows up no errors would be printed.
      // There should be a smart way to buffer stderr, but for now
      // we just won't buffer it.
      if (stream === process.stderr) {
        flushBufferedOutput()
      }
      else {
        if (!timeout) {
          timeout = setTimeout(() => {
            flushBufferedOutput()
            timeout = null
          }, 100)
        }
      }
    }

    stream.write = (chunk: string) => {
      buffer.push(chunk)
      debouncedFlush()
      return true
    }
  }

  async onTestRemoved(trigger?: string) {
    this.ctx.logger.clearScreen(c.yellow('Test removed...') + (trigger ? c.dim(` [ ${this.relative(trigger)} ]\n`) : ''), true)
    this.ctx.logger.log()
    super.onWatcherStart()
  }

  async onTaskUpdate(packs: TaskResultPack[]) {
    // if (this.isTTY)
    // this.renderer!.print()

    this.debouncedEmit()
    super.onTaskUpdate(packs)
  }

  onCollected() {
    if (this.isTTY) {
      this.rendererOptions.logger = this.ctx.logger
      this.rendererOptions.showHeap = this.ctx.config.logHeapUsage
      this.rendererOptions.mode = this.mode
      const files = this.ctx.state.getFiles(this.watchFilters)
      if (!this.renderer)
        this.renderer = createListRenderer(files, this.rendererOptions)
      else
        this.renderer.update(files)
    }
  }

  _emitScheduled = false
  private emit() {
    // const files = this.ctx.state.getFiles(this.watchFilters)
    // // this.renderer?.print()
    // this.removeTestSummary()
    // this.reportRunningSummary(files)
  }

  private debouncedEmit() {
    if (!this._emitScheduled) {
      // Perf optimization to avoid two separate renders When
      // one test finishes and another test starts executing.
      this._emitScheduled = true
      setTimeout(() => {
        this.emit()
        this._emitScheduled = false
      }, 100)
    }
  }

  async onFinished(files = this.ctx.state.getFiles(), errors = this.ctx.state.getUnhandledErrors()) {
    this.renderer?.stop()
    this.ctx.logger.log()
    await super.onFinished(files, errors)
  }

  async onWatcherStart(files = this.ctx.state.getFiles(), errors = this.ctx.state.getUnhandledErrors()) {
    await this.stopListRender()
    await super.onWatcherStart(files, errors)
  }

  async stopListRender() {
    clearInterval(this.timer!)
    this.timer = null
    // this.renderer?.stop()
  }

  async onWatcherRerun(files: string[], trigger?: string) {
    await this.stopListRender()
    await super.onWatcherRerun(files, trigger)
  }

  onUserConsoleLog(log: UserConsoleLog) {
    if (!this.shouldLog(log))
      return
    this.renderer?.clear()
    super.onUserConsoleLog(log)
  }
}
