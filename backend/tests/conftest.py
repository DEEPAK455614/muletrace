import os
import sys

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db.base import Base  # noqa: E402
from app import models  # noqa: F401, E402

VALID_CSV = b"""Transaction ID/UTR,Transaction Date/Time,Fraud Amount,Debit Bank Wallet Merchant,Debit Account Wallet UPI ID,Credit Account Wallet UPI ID
UTR001,01/09/2026 10:00,95000,HDFC Bank,ACC-M1,ACC-M2
UTR002,01/09/2026 11:00,48000,HDFC Bank,ACC-M1,ACC-M3
UTR003,02/09/2026 09:00,140000,ICICI Bank,ACC-M2,ACC-M4
"""

BAD_ROWS_CSV = b"""Transaction ID/UTR,Transaction Date/Time,Fraud Amount,Debit Bank Wallet Merchant,Debit Account Wallet UPI ID,Credit Account Wallet UPI ID
UTR001,01/09/2026 10:00,95000,HDFC Bank,ACC-M1,ACC-M2
UTR002,not-a-date,48000,HDFC Bank,ACC-M1,ACC-M3
UTR003,02/09/2026 09:00,-5,ICICI Bank,ACC-M2,ACC-M4
,02/09/2026 09:00,100,ICICI Bank,ACC-M2,ACC-M4
UTR005,02/09/2026 10:00,200,ICICI Bank,ACC-M2,ACC-M4
"""

DUP_CSV = b"""Transaction ID/UTR,Transaction Date/Time,Fraud Amount,Debit Bank Wallet Merchant,Debit Account Wallet UPI ID,Credit Account Wallet UPI ID
UTR001,01/09/2026 10:00,95000,HDFC Bank,ACC-M1,ACC-M2
UTR001,01/09/2026 10:00,95000,HDFC Bank,ACC-M1,ACC-M2
UTR002,01/09/2026 11:00,48000,HDFC Bank,ACC-M1,ACC-M3
"""

MAPPING = {
    'transaction_id_or_utr': 'Transaction ID/UTR',
    'transaction_datetime': 'Transaction Date/Time',
    'amount_lost': 'Fraud Amount',
    'debit_bank_wallet_merchant': 'Debit Bank Wallet Merchant',
    'debit_account_wallet_upi_id': 'Debit Account Wallet UPI ID',
    'credit_account_wallet_upi_id': 'Credit Account Wallet UPI ID',
}


@pytest.fixture()
def db(tmp_path):
    engine = create_engine(f'sqlite:///{tmp_path}/test.db', connect_args={'check_same_thread': False})
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, expire_on_commit=False)
    session = Session()
    yield session
    session.close()
