Pod::Spec.new do |s|
  s.name           = 'AudiaNative'
  s.version        = '1.0.0'
  s.summary        = 'Audia native module'
  s.description    = 'Audia\'s Android/iOS native surface for stream resolution'
  s.author         = 'ARK DURRANI <5073340abdulrehmankhandurrani@gmail.com>'
  s.homepage       = 'https://github.com/trigxon/Audia'
  s.platforms      = {
    :ios => '16.4',
    :tvos => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
