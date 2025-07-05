import type { ChatMessage as ChatMessageType } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

export default function ChatMessage(message: ChatMessageType) {
  const isUser = message.role === 'user';
  const isError = message.isError;
  const isStreaming = !isUser && !isError && message.content === '';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-6`}>
      <div
        className={`max-w-[75%] px-5 py-4 rounded-2xl shadow-sm ${
          isUser
            ? 'bg-gradient-to-br from-slate-400 to-slate-600 text-white rounded-br-md'
            : isError
              ? 'bg-gradient-to-br from-red-50 to-red-100 text-red-800 border border-red-200 rounded-bl-md shadow-md'
              : 'bg-gradient-to-br from-slate-50 to-slate-100 text-slate-800 border border-slate-200 rounded-bl-md shadow-md hover:shadow-lg transition-shadow duration-200'
        }`}
      >
        {isStreaming ? (
          <div className='flex items-center space-x-3'>
            <div className='flex space-x-1'>
              <div className='w-2 h-2 bg-slate-400 rounded-full animate-bounce'></div>
              <div
                className='w-2 h-2 bg-slate-400 rounded-full animate-bounce'
                style={{ animationDelay: '0.1s' }}
              ></div>
              <div
                className='w-2 h-2 bg-slate-400 rounded-full animate-bounce'
                style={{ animationDelay: '0.2s' }}
              ></div>
            </div>
            <span className='text-slate-600 text-sm font-medium'>
              AI is thinking...
            </span>
          </div>
        ) : (
          <div className='space-y-3'>
            {/* Display images if present */}
            {message.images && message.images.length > 0 && (
              <div className='flex flex-wrap gap-3'>
                {message.images.map((image, index) => (
                  <div key={index} className='relative'>
                    <img
                      src={`data:${image.mimeType};base64,${image.data}`}
                      alt={image.name || `Image ${index + 1}`}
                      className='max-w-full max-h-48 rounded-xl border border-slate-200 shadow-sm'
                      style={{ maxWidth: '200px' }}
                    />
                    {image.name && (
                      <div
                        className={`text-xs mt-2 opacity-75 ${isUser ? 'text-slate-100' : 'text-slate-500'}`}
                      >
                        {image.name}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Display markdown content */}
            {message.content && (
              <div
                className={`prose ${isUser ? 'prose-invert' : 'prose-slate'} max-w-none`}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    // Custom styling for different markdown elements
                    h1: ({ children }) => (
                      <h1 className='text-xl font-bold mb-3 text-current'>
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className='text-lg font-bold mb-2 text-current'>
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className='text-base font-bold mb-2 text-current'>
                        {children}
                      </h3>
                    ),
                    p: ({ children }) => (
                      <p className='mb-3 leading-relaxed text-current'>
                        {children}
                      </p>
                    ),
                    ul: ({ children }) => (
                      <ul className='list-disc list-inside mb-3 space-y-1 text-current'>
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className='list-decimal list-inside mb-3 space-y-1 text-current'>
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li className='text-current'>{children}</li>
                    ),
                    code: ({ children, className }) => {
                      const isInline = !className;
                      if (isInline) {
                        return (
                          <code
                            className={`text-sm font-mono px-1.5 py-0.5 rounded-md ${
                              isUser
                                ? 'bg-slate-500/20 text-slate-100'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {children}
                          </code>
                        );
                      }

                      // Extract language from className (format: language-{lang})
                      const language =
                        className?.replace('language-', '') || 'text';

                      return (
                        <div className='mb-3'>
                          <SyntaxHighlighter
                            language={language}
                            style={oneLight}
                            customStyle={{
                              margin: 0,
                              borderRadius: '0.75rem',
                              fontSize: '0.875rem',
                              lineHeight: '1.5',
                              border: isUser ? 'none' : '1px solid #e2e8f0',
                              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                            }}
                            showLineNumbers={
                              language !== 'text' && language !== 'plaintext'
                            }
                            wrapLines={true}
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        </div>
                      );
                    },
                    pre: ({ children }) => (
                      <pre className='rounded-xl overflow-x-auto mb-3'>
                        {children}
                      </pre>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote
                        className={`border-l-4 pl-4 italic mb-3 ${isUser ? 'border-blue-300' : 'border-slate-300'}`}
                      >
                        {children}
                      </blockquote>
                    ),
                    a: ({ children, href }) => (
                      <a
                        href={href}
                        target='_blank'
                        rel='noopener noreferrer'
                        className={`underline underline-offset-2 font-medium ${
                          isUser
                            ? 'text-blue-200 hover:text-blue-100'
                            : 'text-blue-600 hover:text-blue-700'
                        } transition-colors duration-200`}
                      >
                        {children}
                      </a>
                    ),
                    table: ({ children }) => (
                      <div className='overflow-x-auto mb-3'>
                        <table className='min-w-full border border-slate-200 rounded-lg overflow-hidden shadow-sm'>
                          {children}
                        </table>
                      </div>
                    ),
                    th: ({ children }) => (
                      <th
                        className={`border border-slate-200 px-4 py-3 font-semibold ${
                          isUser
                            ? 'bg-blue-500/20 text-blue-100'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td
                        className={`border border-slate-200 px-4 py-3 ${isUser ? 'text-blue-100' : 'text-slate-700'}`}
                      >
                        {children}
                      </td>
                    ),
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}

        <div
          className={`text-xs mt-3 opacity-70 font-medium ${
            isUser
              ? 'text-blue-100'
              : isError
                ? 'text-red-600'
                : 'text-slate-500'
          }`}
        >
          {message.timestamp.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>
    </div>
  );
}
