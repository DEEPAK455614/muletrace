

def test_wrap_text_respects_width_and_splits_long_tokens():
    from reportlab.pdfbase.pdfmetrics import stringWidth
    from app.services.reporting import wrap_text
    max_w = 170 * 72 / 25.4  # A4 printable width in points
    long = ('Indicator from deterministic rule rapid-pass-through: 99% of observed incoming amount '
            'forwarded within 24h on received total 178000.00 across counterparties ' * 3)
    lines = wrap_text(long, 10, max_w)
    assert len(lines) > 1
    for ln in lines:
        assert stringWidth(ln, 'Helvetica', 10) <= max_w
    # overlong unbroken token (checksum-style) is hard-split, never overflows
    token_lines = wrap_text('x' * 500, 10, max_w)
    assert len(token_lines) > 1
    for ln in token_lines:
        assert stringWidth(ln, 'Helvetica', 10) <= max_w
    # explicit newlines and empty input
    assert wrap_text('', 10, max_w) == ['']
    assert len(wrap_text('a\nb', 10, max_w)) == 2
