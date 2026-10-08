ConvoShop

A Retrieval-Augmented Generation Framework for Intent-Driven E-Commerce Product Advisory

ConvoShop is a conversational e-commerce product advisory system for
mobile phones. It accepts natural-language requirements, retrieves
relevant phone products using semantic search, fetches structured
product metadata, and uses Retrieval-Augmented Generation (RAG) with a
Gemini model to generate a conversational recommendation.

1. Project Overview

Users can describe what they need without manually selecting multiple
filters.

Example

> I need a phone with a good camera and battery life under ₹30,000.

The system processes the requirement, retrieves relevant phone
candidates, obtains their structured metadata, and generates a
recommendation using the retrieved information as context.


2. Objectives

-   Understand mobile-phone requirements expressed in natural language.
-   Extract requirements such as category, features, budget, and use
    case.
-   Retrieve semantically relevant phone products.
-   Retrieve structured product metadata for candidate products.
-   Ground LLM responses using retrieved product information.
-   Provide conversational product recommendations.
-   Support follow-up queries when session context is available.

3. System Architecture

``` mermaid
flowchart TD
    A[User Query] --> B[Intent / Requirement Understanding]
    B --> C[Sentence Transformer]
    C --> D[Pinecone Semantic Retrieval]
    D --> E[Relevant Phone Candidates]
    E --> F[MongoDB Atlas]
    F --> G[Structured Product Metadata]
    B --> H[User Requirements]
    G --> I[RAG Context]
    H --> I
    I --> J[Gemini LLM]
    J --> K[Recommendation + Explanation]
    K --> L[React.js Frontend]
    L --> M[Follow-up Query]
    M --> B
```

Component Responsibilities

  -----------------------------------------------------------------------
  Component                           Responsibility
  ----------------------------------- -----------------------------------
  React.js                            Conversational frontend

  FastAPI                             Backend/API orchestration

  Intent / Requirement Understanding  Converts the user request into
                                      retrieval requirements

  Sentence Transformer                Creates semantic embeddings

  Pinecone                            Semantic vector retrieval

  MongoDB Atlas                       Stores and retrieves structured
                                      product metadata

  RAG                                 Supplies retrieved product
                                      information as LLM context

  Gemini                              Generates the final recommendation
                                      and explanation
  -----------------------------------------------------------------------

4. Dataset

The current project uses a cleaned mobile-phone product dataset
containing **279 records**.

The README refers to the information as **structured product metadata**.
It does not claim that the data is verified, live, or includes
availability/review information unless those fields are actually present
in the repository schema.

Data source:Public dataset used for the project. Add the exact
Kaggle/Hugging Face dataset name, URL, and license here after checking
the repository files.

5. Retrieval Pipeline

Step 1 --- Requirement Understanding

A natural-language request is converted into useful requirements.

For example:

``` text
Category  → Mobile Phone
Budget    → ₹30,000
Features  → Camera + Battery Life
```

The exact implementation of this decomposition should match the backend
code.

Step 2 --- Semantic Embedding

The processed requirement is converted into a vector representation
using the project's Sentence Transformer model.

Step 3 --- Pinecone Retrieval

The query embedding is used for semantic similarity search in Pinecone
to retrieve relevant phone candidates.

Semantic similarity alone does **not** guarantee an exact numeric
constraint such as `Price < ₹30,000`.

If the application applies a separate price metadata filter, that filter
should be documented from the actual implementation.

Step 4 --- MongoDB Retrieval

MongoDB Atlas is used to retrieve the structured product metadata
associated with the selected candidates.

``` text
Pinecone
   ↓
Relevant product candidates

MongoDB Atlas
   ↓
Structured product metadata
```

6. Retrieval-Augmented Generation

ConvoShop supplies retrieved product information to the LLM as context.

``` mermaid
flowchart LR
    A[User Requirements] --> C[RAG Context]
    B[Retrieved Product Metadata] --> C
    C --> D[Gemini LLM]
    D --> E[Recommendation + Explanation]
```

RAG helps ground the generated response in retrieved product
information. It reduces the risk of unsupported claims but does not
guarantee that every generated statement is correct.

7. Recommendation Generation

The Gemini model receives the user requirements together with the
retrieved product context and generates the final conversational
response.

The README treats **recommendation and explanation as one LLM stage**.
It does not claim a separate ranking engine unless such a module exists
in the code.

8. Example Interaction

**User**

> I need a phone with a good camera and battery life under ₹30,000.

**System interpretation**

``` text
Product Category → Mobile Phone
Budget           → ₹30,000
Required Features → Camera + Battery Life
```

**Retrieval**

``` text
Requirements
     ↓
Sentence Transformer
     ↓
Pinecone
     ↓
Phone Candidates
     ↓
MongoDB
     ↓
Structured Product Metadata
```

**Generation**

``` text
User Requirements + Retrieved Metadata
                 ↓
             RAG Context
                 ↓
             Gemini LLM
                 ↓
        Recommendation + Explanation
```

9. Conversational Follow-up

When session context is implemented, users can continue a conversation
without repeating the complete requirement.

``` text
User: Recommend a phone under ₹30,000 with a good camera.

System: [Recommendations]

User: Which one has the best battery?

System: [Follow-up response]
```

The exact mechanism used to store and reuse conversation context should
be documented according to the backend implementation.

10. Technology Stack

-   **Frontend:** React.js
-   **Backend:** FastAPI
-   **Embeddings:** Sentence Transformer
-   **Vector Search:** Pinecone
-   **Database:** MongoDB Atlas
-   **Generative AI:** Gemini model used by the backend
-   **Architecture:** Retrieval-Augmented Generation (RAG)

Gemini model

The project report refers to **Gemini 1.5 Flash**. Before publishing the
final README, verify the exact Gemini model string in the backend code
and replace the generic wording above with that exact model name.

11. Repository Structure

Keep this section synchronized with the actual repository:

``` text
final_year/
├── Frontend/
│   └── my-react-app/
├── Phone_Datasets/
├── Backend/
│   └── ...
└── README.md
```

12. Setup

Prerequisites

-   Python 3.x
-   Node.js and npm
-   MongoDB Atlas configuration
-   Pinecone configuration
-   Gemini API access

Clone

``` bash
git clone <YOUR-REPOSITORY-URL>
cd final_year
```

Backend

``` powershell
cd Backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Frontend

``` bash
cd Frontend/my-react-app
npm install
npm run dev
```

Environment Variables

Never commit API keys or passwords to GitHub.

Use the exact variable names defined by the project code. They may
include values such as:

``` text
MONGODB_URI
PINECONE_API_KEY
PINECONE_INDEX
GEMINI_API_KEY
```

13. Evaluation

The README does not claim quantitative improvements such as Precision@K,
Recall@K, or reduced hallucination rates unless those experiments have
actually been performed.

Useful evaluation measures for the project include:

-   Retrieval relevance
-   Precision@K
-   Recall@K
-   Budget-constraint accuracy
-   Recommendation quality
-   Comparison with keyword-based search
-   Comparison with a standalone LLM
-   User evaluation

14. Limitations

-   Semantic similarity alone does not guarantee exact numeric
    constraints such as price.
-   Recommendation quality depends on the coverage and quality of the
    product dataset.
-   Products absent from the knowledge base cannot be recommended.
-   LLM-generated explanations can still contain errors.
-   Results depend on the retrieval configuration, metadata, and model
    used by the application.

15. Future Scope

-   Improve requirement and intent extraction.
-   Add robust numeric and metadata filtering.
-   Improve retrieval and re-ranking.
-   Expand the product dataset.
-   Add additional product categories.
-   Add real-time product information where appropriate.
-   Evaluate retrieval and recommendation quality using standard
    metrics.
-   Compare against keyword search and a standalone LLM baseline.
-   Improve conversational memory.

16. Conclusion

ConvoShop combines natural-language requirement understanding, semantic
product retrieval, structured product metadata, Retrieval-Augmented
Generation, and LLM reasoning for conversational mobile-phone
recommendations.

The core workflow is:

``` text
Understand the requirement
        ↓
Retrieve relevant phones
        ↓
Fetch structured product metadata
        ↓
Ground the LLM with retrieved context
        ↓
Generate the recommendation
```

Project

**ConvoShop: A Retrieval-Augmented Generation Framework for
Intent-Driven E-Commerce Product Advisory**

Academic final-year project.

Team and Guide

Add the project team members and project guide here.

License

No open-source license is claimed unless a `LICENSE` file is included in
the repository. If the project is intended for public reuse, add an
appropriate license file.
