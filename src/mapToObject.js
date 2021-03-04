export default function mapToObject(value) {
  return [...value.keys()].reduce((out, key) => {
    try {
      // eslint-disable-next-line no-param-reassign
      out[key] = value.get(key);
    } catch (err) {

    }
    return out;
  }, {});
}
