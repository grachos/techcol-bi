import { useTranslation } from 'react-i18next'
import { ContentSection } from '../components/content-section'
import { DisplayForm } from './display-form'

export function SettingsDisplay() {
  const { t } = useTranslation()
  return (
    <ContentSection
      title={t('Display')}
      desc={t("Turn items on or off to control what's displayed in the app.")}
    >
      <DisplayForm />
    </ContentSection>
  )
}
