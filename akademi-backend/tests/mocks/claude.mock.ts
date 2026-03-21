export const mockClaudeResponse = (content: string) => ({
  content: [{ type: 'text', text: content }]
});

jest.mock('@anthropic-ai/sdk', () => ({
  Anthropic: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue(
        mockClaudeResponse('Mocked AI response for testing')
      )
    }
  }))
}));
