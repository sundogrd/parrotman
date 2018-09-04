module.exports = {
  hooks: {
      'commit-msg': 'commitlint -e $GIT_PARAMS --config ./commitlint.config.js',
      'pre-commit': 'npm run lint && sh ./scripts/common/build/check-branch-name.sh'
  }
}
