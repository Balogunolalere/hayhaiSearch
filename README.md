# HayhaiSearch 🔍

A modern, AI-powered search interface that combines Qwant search with AI processing to provide comprehensive, well-structured answers to your questions.

## Features 🌟

- **Intelligent Search**: Automatically determines the best search type (web, news, videos) based on your question
- **AI-Powered Answers**: Uses Google's Gemini AI to analyze and synthesize information from multiple sources
- **Multi-Source Integration**: 
  - Web search results
  - News articles
  - YouTube video transcripts
  - Real-time content analysis
- **Modern UI**:
  - Neobrutalist design
  - Fully responsive
  - Dark mode support
  - Loading states and error handling
- **Performance**:
  - Built-in caching
  - Response compression
  - Rate limiting
  - Parallel processing

## Tech Stack 🛠️

### Frontend
- Next.js 14 (React)
- TypeScript
- Tailwind CSS
- SWR for data fetching
- Radix UI Icons

### Backend
- FastAPI
- Python 3.10+
- Google Gemini AI
- Beautiful Soup 4
- aiohttp for async requests
- YouTube Transcript API

## Getting Started 🚀

### Prerequisites
- Python 3.10 or higher
- Node.js 18 or higher
- Yarn or npm

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/hayhaiSearch.git
cd hayhaiSearch
```

2. Set up the backend:
```bash
# Create and activate virtual environment
python -m venv env
source env/bin/activate  # On Windows: .\env\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file and add your API keys
cp .env.example .env
```

3. Set up the frontend:
```bash
cd frontend
yarn install  # or npm install
```

### Running the Application

1. Start the backend server:
```bash
# From the root directory
source env/bin/activate
uvicorn web_agent:app --reload
```

2. Start the frontend development server:
```bash
# From the frontend directory
yarn dev  # or npm run dev
```

3. Open http://localhost:3000 in your browser

## API Documentation 📚

### Search Endpoint

```http
POST /search
Content-Type: application/json

{
  "question": "string",
  "max_results": number (optional, default: 6)
}
```

Response:
```json
{
  "answer": "string",
  "sources": ["string"],
  "search_type": "string"
}
```

## Project Structure 📁

```
hayhaiSearch/
├── frontend/              # Next.js frontend application
│   ├── src/
│   │   ├── app/          # Next.js app router pages
│   │   ├── components/   # React components
│   │   └── lib/         # Utility functions
│   └── public/          # Static assets
├── web_agent.py         # FastAPI backend
└── requirements.txt     # Python dependencies
```

## Contributing 🤝

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License 📜

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments 👏

- [Qwant](https://www.qwant.com/) for providing the search API
- [Google Gemini AI](https://ai.google.dev/) for powering the AI responses
- [Next.js](https://nextjs.org/) and [FastAPI](https://fastapi.tiangolo.com/) for the awesome frameworks
- The open-source community for all the amazing tools and libraries