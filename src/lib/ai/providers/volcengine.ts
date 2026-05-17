import { OpenAICompatibleProvider } from './openai-compatible'
import { AIVendor } from '@/types'

export class VolcEngineProvider extends OpenAICompatibleProvider {
  readonly name = 'VolcEngine (火山引擎)'
  readonly vendor = AIVendor.VOLCENGINE
  protected readonly defaultBaseURL = 'https://ark.cn-beijing.volces.com/api/coding/v3'
}
