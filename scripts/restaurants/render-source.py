"""Render a local official PDF page for column and serving-basis inspection."""
import sys
from pathlib import Path
import pypdfium2 as pdfium
raw=Path(__file__).resolve().parents[2]/'data-sources/restaurants/raw/stage3a2'
key,page=sys.argv[1],int(sys.argv[2]);doc=pdfium.PdfDocument(raw/(key+'.pdf'))
doc[page-1].render(scale=1.8).to_pil().save(raw/f'{key}-review-{page}.png')
