CREATE FUNCTION works_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('french', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('french', coalesce(array_to_string(NEW.tags, ' '), '')), 'A') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.tags, ' '), '')), 'A') ||
    setweight(to_tsvector('french', coalesce(array_to_string(NEW.stack, ' '), '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.stack, ' '), '')), 'B') ||
    setweight(to_tsvector('french', coalesce(NEW.summary, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.summary, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER works_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, summary, tags, stack ON works
  FOR EACH ROW EXECUTE FUNCTION works_search_vector_update();
