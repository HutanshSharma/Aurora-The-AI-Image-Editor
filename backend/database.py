from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

SQLALCHEMY_DATABASE_URL = 'sqlite:///./authen.db'

engine = create_engine(SQLALCHEMY_DATABASE_URL)

Sessionmaker =sessionmaker(autoflush=False, autocommit = False, bind= engine)

Base = declarative_base()