import React from 'react';
import { useParams } from 'react-router-dom';
import NewsList from '../components/News/NewsList';
import ArticleDetail from '../components/News/ArticleDetail';

export default function News() {
  const { id } = useParams();

  if (id) {
    return <ArticleDetail />;
  }

  return <NewsList />;
}
