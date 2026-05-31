import { ErrorCategory } from './types';

export const ErrorMessages: Record<string, {
  message: string;
  suggestions?: string[];
}> = {
  'PROJECT_001': {
    message: '项目不存在或已被删除',
    suggestions: [
      '检查项目ID是否正确',
      '刷新页面后重试',
      '联系技术支持获取帮助'
    ]
  },
  'PROJECT_002': {
    message: '创建项目失败，请稍后重试',
    suggestions: [
      '检查网络连接',
      '稍后重试',
      '如果问题持续存在，请联系支持'
    ]
  },
  'PROJECT_003': {
    message: '更新项目失败，请稍后重试',
    suggestions: [
      '检查网络连接',
      '确认项目信息格式正确'
    ]
  },
  'PROJECT_004': {
    message: '删除项目失败，请稍后重试',
    suggestions: [
      '检查网络连接',
      '确认项目没有被其他操作占用'
    ]
  },

  'CHAPTER_001': {
    message: '章节不存在',
    suggestions: [
      '检查章节ID是否正确',
      '确认章节未被删除'
    ]
  },
  'CHAPTER_002': {
    message: '章节生成失败',
    suggestions: [
      '检查AI配置是否正确',
      '查看配额是否充足',
      '尝试重新生成'
    ]
  },
  'CHAPTER_003': {
    message: '章节内容验证失败',
    suggestions: [
      '检查章节内容是否完整',
      '确保字数在要求范围内'
    ]
  },
  'CHAPTER_004': {
    message: '章节字数超出限制',
    suggestions: [
      '检查目标字数设置',
      '调整章节内容长度'
    ]
  },

  'AI_001': {
    message: 'AI服务暂时不可用',
    suggestions: [
      '稍后重试',
      '检查AI服务商状态',
      '切换到其他AI模型'
    ]
  },
  'AI_002': {
    message: 'AI配置无效',
    suggestions: [
      '检查API Key是否正确',
      '确认API Key有足够配额'
    ]
  },
  'AI_003': {
    message: 'AI调用频率超限',
    suggestions: [
      '等待一段时间后重试',
      '降低请求频率'
    ]
  },
  'AI_004': {
    message: 'AI配额已用完',
    suggestions: [
      '升级您的订阅计划',
      '等待配额重置',
      '联系客服申请临时提升'
    ]
  },
  'AI_005': {
    message: 'AI生成超时',
    suggestions: [
      '尝试简化请求内容',
      '检查网络连接',
      '稍后重试'
    ]
  },

  'DB_001': {
    message: '数据库连接失败',
    suggestions: [
      '稍后重试',
      '如果问题持续，请联系支持'
    ]
  },
  'DB_002': {
    message: '数据操作失败',
    suggestions: [
      '检查输入数据是否正确',
      '稍后重试'
    ]
  },
  'DB_003': {
    message: '数据库事务失败',
    suggestions: [
      '稍后重试',
      '检查是否有冲突操作'
    ]
  },

  'VALIDATION_001': {
    message: '输入数据无效',
    suggestions: [
      '检查必填字段是否填写',
      '确保数据格式正确'
    ]
  },
  'VALIDATION_002': {
    message: '缺少必要的参数',
    suggestions: [
      '检查请求参数是否完整',
      '查看API文档确认必填字段'
    ]
  },
  'VALIDATION_003': {
    message: '数据格式不正确',
    suggestions: [
      '检查数据格式',
      '参考API文档中的格式要求'
    ]
  },

  [ErrorCategory.INTERNAL]: {
    message: '服务器内部错误',
    suggestions: [
      '稍后重试',
      '如果问题持续，请联系支持'
    ]
  },
  [ErrorCategory.AUTHENTICATION]: {
    message: '认证失败',
    suggestions: [
      '请重新登录',
      '检查登录状态是否过期'
    ]
  },
  [ErrorCategory.AUTHORIZATION]: {
    message: '没有权限执行此操作',
    suggestions: [
      '检查您的权限设置',
      '联系管理员获取相应权限'
    ]
  },
  [ErrorCategory.NOT_FOUND]: {
    message: '请求的资源不存在',
    suggestions: [
      '检查请求的ID或路径是否正确',
      '刷新页面后重试'
    ]
  },
  [ErrorCategory.PIPELINE]: {
    message: '流水线执行失败',
    suggestions: [
      '稍后重试',
      '检查输入参数是否正确'
    ]
  }
};
