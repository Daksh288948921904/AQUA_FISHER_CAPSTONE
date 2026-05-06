import pdfplumber
from pypdf import PdfReader
def extract_text_from_pdf(path:str)->str:
    try:
        text_parts=[]
        with pdfplumber.open(path) as pdf:
            for i, page in enumerate(pdf.pages):
                page_text=page.extract_text()
                if page_text:
                    text_parts.append(f"--- Page {i+1} ---\n{page_text}")
                tables=page.extract_tables()
                for j, table in enumerate(tables):
                    text_parts.append(f"\n[Table {j+1} on Page {i+1}]")
                    for row in table:
                        cleaned = [str(c).strip() if c else "" for c in row]
                        text_parts.append("|".join(cleaned))
        result = "\n".join(text_parts)
        if len(result.strip()) > 50:
            return result
    except Exception:
        pass
    reader=PdfReader(path)
    parts=[]
    for i, page in enumerate(reader.pages):
        t = page.extract_text()
        if t:
            parts.append(f"--- Page {i+1} ---\n{t}")
    return "\n".join(parts)

                    