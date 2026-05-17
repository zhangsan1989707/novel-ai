import { OpenAICompatibleProvider } from './openai-compatible'
import { AIVendor } from '@/types'

export class MiniMaxProvider extends OpenAICompatibleProvider {
  readonly name = 'MiniMax'
  readonly vendor = AIVendor.MINIMAX
  protected readonly defaultBaseURL = 'https://api.minimax.chat/v1'
  protected readonly chatPath = '/text/chatcompletion_v2'
}
