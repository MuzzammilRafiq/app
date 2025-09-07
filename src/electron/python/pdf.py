def text_file_to_chunk_simple(path, chunk_size=300):
    def divide_by_words_simple(text, chunk_size=300):
        chunks = []
        words = text.split()
        lines = text.split('\n')
        
        # Create a mapping of word position to line number
        word_to_line = {}
        current_line = 1
        word_count = 0
        
        for line in lines:
            line_words = line.split()
            for _ in line_words:
                word_to_line[word_count] = current_line
                word_count += 1
            current_line += 1
        
        # Create chunks
        for i in range(0, len(words), chunk_size):
            chunk_words = words[i:i+chunk_size]
            chunk_text = ' '.join(chunk_words)
            start_line = word_to_line.get(i, 1)
            chunks.append((start_line, "text", chunk_text))
        
        return chunks
    
    with open(path, 'r', encoding='utf-8') as file:
        text = file.read()
    
    chunks = divide_by_words_simple(text, chunk_size)
    return chunks
